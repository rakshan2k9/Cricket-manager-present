import { AsyncLocalStorage } from 'async_hooks';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

export interface AuthRequestContext {
  uid: string;
  idToken: string;
}

export const authContextStorage = new AsyncLocalStorage<AuthRequestContext>();

export function runWithAuthContext<T>(ctx: AuthRequestContext, fn: () => T): T {
  return authContextStorage.run(ctx, fn);
}

export function getAuthContext(): AuthRequestContext | undefined {
  return authContextStorage.getStore();
}

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents`;

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function encodeValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (val instanceof Date) return { stringValue: val.toISOString() };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = encodeValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function decodeValue(fv: FirestoreValue | undefined): unknown {
  if (!fv) return undefined;
  if ('nullValue' in fv) return null;
  if ('booleanValue' in fv) return fv.booleanValue;
  if ('integerValue' in fv) return Number(fv.integerValue);
  if ('doubleValue' in fv) return fv.doubleValue;
  if ('timestampValue' in fv) return fv.timestampValue;
  if ('stringValue' in fv) return fv.stringValue;
  if ('arrayValue' in fv) return (fv.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in fv) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fv.mapValue.fields || {})) {
      out[k] = decodeValue(v);
    }
    return out;
  }
  return undefined;
}

function encodeFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = encodeValue(v);
  }
  return fields;
}

function decodeDoc(doc: any): Record<string, unknown> | null {
  if (!doc || !doc.fields) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc.fields as Record<string, FirestoreValue>)) {
    out[k] = decodeValue(v);
  }
  return out;
}

async function firestoreGetDoc(docPath: string, idToken: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}?key=${firebaseConfig.apiKey}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) return null;
  const json = await res.json();
  return decodeDoc(json);
}

async function firestoreUpsertDoc(
  docPath: string,
  data: Record<string, unknown>,
  idToken: string
): Promise<boolean> {
  const res = await fetch(`${FIRESTORE_BASE}/${docPath}?key=${firebaseConfig.apiKey}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: encodeFields(data) }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status !== 403) {
      console.warn(`[FirestoreSync] PATCH ${docPath} -> ${res.status}: ${txt.slice(0, 180)}`);
    }
    return false;
  }
  return true;
}

async function firestoreRunQuery(
  collectionId: string,
  fieldPath: string,
  op: 'ARRAY_CONTAINS' | 'EQUAL',
  value: string | number,
  idToken: string
): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op,
            value: typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value },
          },
        },
      },
    }),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as any[];
  const docs: Record<string, unknown>[] = [];
  for (const item of rows) {
    if (item.document) {
      const parsed = decodeDoc(item.document);
      if (parsed) docs.push(parsed);
    }
  }
  return docs;
}

export interface PersistedTablesPayload {
  counters: Record<string, number>;
  tables: Record<string, Record<string, unknown>[]>;
}

const LEAGUE_SECTIONS = {
  core: ['league_members', 'teams', 'lineups'],
  players: ['players', 'player_contracts'],
  auction: ['auctions', 'auction_players', 'bids'],
  matches: ['matches', 'fixtures'],
  comms: ['league_messages', 'notifications', 'league_news', 'trade_offers'],
} as const;

export function getTablesForSection(section: keyof typeof LEAGUE_SECTIONS): readonly string[] {
  return LEAGUE_SECTIONS[section];
}

const LEAGUE_DEPENDENT_TABLES = new Set<string>([
  'leagues',
  'league_members',
  'teams',
  'lineups',
  'players',
  'player_contracts',
  'auctions',
  'auction_players',
  'bids',
  'matches',
  'fixtures',
  'league_messages',
  'notifications',
  'league_news',
  'trade_offers',
]);

export async function syncSnapshotChangesToFirestore(
  snapshot: PersistedTablesPayload,
  changedTables: Set<string>,
  touchedLeagueIds: Set<number>
): Promise<void> {
  const ctx = getAuthContext();
  if (!ctx?.idToken || !ctx.uid) return;

  const { uid, idToken } = ctx;
  const tasks: Promise<unknown>[] = [];
  const nowIso = new Date().toISOString();

  if (changedTables.has('users')) {
    const userRow = (snapshot.tables.users || []).find((r) => r.uid === uid);
    if (userRow) {
      tasks.push(
        firestoreUpsertDoc(
          `users/${uid}`,
          {
            id: Number(userRow.id) || 1,
            uid,
            email: String(userRow.email || ''),
            createdAt:
              userRow.createdAt instanceof Date
                ? userRow.createdAt.toISOString()
                : String(userRow.createdAt || nowIso),
          },
          idToken
        )
      );
    }
  }

  if (changedTables.has('manager_profiles')) {
    const prof = (snapshot.tables.manager_profiles || []).find((r) => r.userUid === uid);
    if (prof) {
      tasks.push(
        firestoreUpsertDoc(
          `profiles/${uid}`,
          {
            ...prof,
            updatedAt:
              prof.updatedAt instanceof Date
                ? prof.updatedAt.toISOString()
                : String(prof.updatedAt || nowIso),
          },
          idToken
        )
      );
    }
  }

  if (changedTables.has('friendships')) {
    for (const f of snapshot.tables.friendships || []) {
      if (f.requesterUid === uid || f.addresseeUid === uid) {
        tasks.push(
          firestoreUpsertDoc(
            `friendships/${f.id}`,
            {
              id: Number(f.id),
              requesterUid: String(f.requesterUid),
              addresseeUid: String(f.addresseeUid),
              status: String(f.status || 'pending'),
              createdAt:
                f.createdAt instanceof Date
                  ? f.createdAt.toISOString()
                  : String(f.createdAt || nowIso),
              updatedAt:
                f.updatedAt instanceof Date
                  ? f.updatedAt.toISOString()
                  : String(f.updatedAt || nowIso),
            },
            idToken
          )
        );
      }
    }
  }

  if (changedTables.has('direct_messages')) {
    const recentDms = (snapshot.tables.direct_messages || [])
      .filter((d) => d.senderUid === uid || d.recipientUid === uid)
      .slice(-20);
    for (const d of recentDms) {
      tasks.push(
        firestoreUpsertDoc(
          `directMessages/${d.id}`,
          {
            id: Number(d.id),
            senderUid: String(d.senderUid),
            recipientUid: String(d.recipientUid),
            body: String(d.body || ''),
            ...(d.inviteCode ? { inviteCode: String(d.inviteCode) } : {}),
            ...(d.inviteLeagueName ? { inviteLeagueName: String(d.inviteLeagueName) } : {}),
            isRead: Boolean(d.isRead),
            createdAt:
              d.createdAt instanceof Date
                ? d.createdAt.toISOString()
                : String(d.createdAt || nowIso),
          },
          idToken
        )
      );
    }
  }

  const hasLeagueChange = Array.from(changedTables).some((t) => LEAGUE_DEPENDENT_TABLES.has(t));
  if (hasLeagueChange && touchedLeagueIds.size > 0) {
    for (const leagueId of touchedLeagueIds) {
      const league = (snapshot.tables.leagues || []).find((l) => Number(l.id) === leagueId);
      if (!league) continue;

      const members = (snapshot.tables.league_members || []).filter(
        (m) => Number(m.leagueId) === leagueId
      );
      const memberUids = Array.from(
        new Set([String(league.hostUid), ...members.map((m) => String(m.userUid))])
      ).slice(0, 12);

      if (!memberUids.includes(uid)) continue;

      tasks.push(
        firestoreUpsertDoc(
          `leagues/${leagueId}`,
          {
            id: leagueId,
            name: String(league.name),
            inviteCode: String(league.inviteCode),
            hostUid: String(league.hostUid),
            primaryCompetition: String(league.primaryCompetition || 'IPL'),
            status: String(league.status || 'setup'),
            memberUids,
            leagueJson: JSON.stringify(league),
            updatedAt: nowIso,
          },
          idToken
        )
      );

      if (String(league.hostUid) === uid && changedTables.has('leagues')) {
        tasks.push(
          firestoreUpsertDoc(
            `leagueInvites/${String(league.inviteCode)}`,
            {
              inviteCode: String(league.inviteCode),
              leagueId,
              leagueName: String(league.name),
              hostUid: String(league.hostUid),
              updatedAt: nowIso,
            },
            idToken
          )
        );
      }

      for (const [section, tableNames] of Object.entries(LEAGUE_SECTIONS)) {
        const shouldSyncSection =
          changedTables.has('leagues') || tableNames.some((t) => changedTables.has(t));
        if (!shouldSyncSection) continue;

        const sectionData: Record<string, unknown[]> = {};
        for (const tName of tableNames) {
          sectionData[tName] = (snapshot.tables[tName] || []).filter(
            (row) => Number(row.leagueId) === leagueId
          );
        }

        tasks.push(
          firestoreUpsertDoc(
            `leagues/${leagueId}/state/${section}`,
            {
              section,
              payloadJson: JSON.stringify(sectionData),
              updatedAt: nowIso,
            },
            idToken
          )
        );
      }
    }
  }

  await Promise.allSettled(tasks);
}

export async function fetchUserAndLeaguesFromFirestore(
  uid: string,
  idToken: string
): Promise<{
  user: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  leagues: Array<{
    league: Record<string, unknown>;
    sections: Record<string, Record<string, unknown[]>>;
  }>;
}> {
  const [userDoc, profileDoc, leagueDocs] = await Promise.all([
    firestoreGetDoc(`users/${uid}`, idToken),
    firestoreGetDoc(`profiles/${uid}`, idToken),
    firestoreRunQuery('leagues', 'memberUids', 'ARRAY_CONTAINS', uid, idToken),
  ]);

  const hydratedLeagues: Array<{
    league: Record<string, unknown>;
    sections: Record<string, Record<string, unknown[]>>;
  }> = [];

  for (const lDoc of leagueDocs) {
    const lid = Number(lDoc.id);
    if (!lid || typeof lDoc.leagueJson !== 'string') continue;
    try {
      const parsedLeague = JSON.parse(lDoc.leagueJson) as Record<string, unknown>;
      const sections: Record<string, Record<string, unknown[]>> = {};
      const sectionNames = Object.keys(LEAGUE_SECTIONS);
      const secDocs = await Promise.all(
        sectionNames.map((sec) => firestoreGetDoc(`leagues/${lid}/state/${sec}`, idToken))
      );
      sectionNames.forEach((sec, idx) => {
        const sDoc = secDocs[idx];
        if (sDoc && typeof sDoc.payloadJson === 'string') {
          try {
            sections[sec] = JSON.parse(sDoc.payloadJson);
          } catch {}
        }
      });
      hydratedLeagues.push({ league: parsedLeague, sections });
    } catch {}
  }

  return { user: userDoc, profile: profileDoc, leagues: hydratedLeagues };
}

export async function fetchLeagueByInviteFromFirestore(
  inviteCode: string,
  idToken: string
): Promise<{
  league: Record<string, unknown>;
  sections: Record<string, Record<string, unknown[]>>;
} | null> {
  const inviteDoc = await firestoreGetDoc(`leagueInvites/${inviteCode.trim().toUpperCase()}`, idToken);
  if (!inviteDoc || !inviteDoc.leagueId) return null;

  const lid = Number(inviteDoc.leagueId);
  // Temporarily look up league doc; note Firestore rules allow reading once member or if host
  const lDoc = await firestoreGetDoc(`leagues/${lid}`, idToken);
  if (!lDoc || typeof lDoc.leagueJson !== 'string') return null;

  const parsedLeague = JSON.parse(lDoc.leagueJson) as Record<string, unknown>;
  const sections: Record<string, Record<string, unknown[]>> = {};
  const sectionNames = Object.keys(LEAGUE_SECTIONS);
  const secDocs = await Promise.all(
    sectionNames.map((sec) => firestoreGetDoc(`leagues/${lid}/state/${sec}`, idToken))
  );
  sectionNames.forEach((sec, idx) => {
    const sDoc = secDocs[idx];
    if (sDoc && typeof sDoc.payloadJson === 'string') {
      try {
        sections[sec] = JSON.parse(sDoc.payloadJson);
      } catch {}
    }
  });

  return { league: parsedLeague, sections };
}
