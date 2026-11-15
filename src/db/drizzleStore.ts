import fs from 'fs';
import path from 'path';
import { getTableName, type SQL } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import * as schema from './schema.ts';
import {
  syncSnapshotChangesToFirestore,
  type PersistedTablesPayload,
} from './firestoreSync.ts';

interface ColMeta {
  jsKey: string;
  sqlName: string;
  primary: boolean;
  isSerial: boolean;
  isUnique: boolean;
  hasDefault: boolean;
  defaultVal: unknown;
  isDate: boolean;
  notNull: boolean;
}

interface FkMeta {
  cols: string[];
  foreignTable: string;
  foreignCols: string[];
  onDelete: string | null | undefined;
}

interface TableMeta {
  sqlName: string;
  table: PgTable;
  columns: ColMeta[];
  byJsKey: Map<string, ColMeta>;
  bySqlName: Map<string, ColMeta>;
  uniqueSets: string[][];
  foreignKeys: FkMeta[];
}

function buildSchemaMetadata(): {
  byTableObj: Map<unknown, TableMeta>;
  bySqlName: Map<string, TableMeta>;
} {
  const byTableObj = new Map<unknown, TableMeta>();
  const bySqlName = new Map<string, TableMeta>();

  for (const val of Object.values(schema)) {
    if (!val || typeof val !== 'object') continue;
    let cfg: ReturnType<typeof getTableConfig>;
    let sqlName: string;
    try {
      sqlName = getTableName(val as PgTable);
      cfg = getTableConfig(val as PgTable);
    } catch {
      continue;
    }
    if (!sqlName || !cfg?.columns) continue;

    const sqlToJs = new Map<string, string>();
    for (const [k, prop] of Object.entries(val)) {
      if (prop && typeof prop === 'object' && 'name' in prop && 'table' in prop) {
        sqlToJs.set(String((prop as any).name), k);
      }
    }

    const columns: ColMeta[] = cfg.columns.map((c: any) => ({
      jsKey: sqlToJs.get(c.name) || c.name,
      sqlName: c.name,
      primary: Boolean(c.primary),
      isSerial: c.columnType === 'PgSerial',
      isUnique: Boolean(c.isUnique),
      hasDefault: Boolean(c.hasDefault),
      defaultVal: c.default,
      isDate: c.dataType === 'date',
      notNull: Boolean(c.notNull),
    }));

    const byJsKey = new Map<string, ColMeta>();
    const byColSql = new Map<string, ColMeta>();
    for (const col of columns) {
      byJsKey.set(col.jsKey, col);
      byColSql.set(col.sqlName, col);
    }

    const uniqueSets: string[][] = [];
    for (const col of columns) {
      if (col.primary || col.isUnique) {
        uniqueSets.push([col.jsKey]);
      }
    }
    for (const ix of cfg.indexes || []) {
      if (ix.config?.unique) {
        const keys = (ix.config.columns || [])
          .map((c: any) => sqlToJs.get(c.name) || c.name)
          .filter(Boolean);
        if (keys.length > 0) uniqueSets.push(keys);
      }
    }

    const foreignKeys: FkMeta[] = (cfg.foreignKeys || []).map((fk: any) => {
      const ref = fk.reference();
      return {
        cols: ref.columns.map((c: any) => sqlToJs.get(c.name) || c.name),
        foreignTable: getTableName(ref.foreignTable),
        foreignCols: ref.foreignColumns.map(
          (c: any) => getTableSqlToJs(ref.foreignTable, c.name)
        ),
        onDelete: fk.onDelete ?? ref.onDelete,
      };
    });

    const meta: TableMeta = {
      sqlName,
      table: val as PgTable,
      columns,
      byJsKey,
      bySqlName: byColSql,
      uniqueSets,
      foreignKeys,
    };

    byTableObj.set(val, meta);
    bySqlName.set(sqlName, meta);
  }

  return { byTableObj, bySqlName };
}

function getTableSqlToJs(tableObj: any, colSqlName: string): string {
  for (const [k, prop] of Object.entries(tableObj || {})) {
    if (prop && typeof prop === 'object' && (prop as any).name === colSqlName) {
      return k;
    }
  }
  return colSqlName;
}

const SCHEMA_META = buildSchemaMetadata();

function isColumnObj(node: any): boolean {
  return Boolean(node && typeof node === 'object' && 'name' in node && 'table' in node);
}

function isParamObj(node: any): boolean {
  return Boolean(node && typeof node === 'object' && node.constructor?.name === 'Param');
}

function isSqlObj(node: any): node is SQL {
  return Boolean(node && typeof node === 'object' && Array.isArray(node.queryChunks));
}

function isStringChunk(node: any): boolean {
  return Boolean(
    node &&
      typeof node === 'object' &&
      node.constructor?.name === 'StringChunk' &&
      Array.isArray(node.value)
  );
}

type RowContext = Map<string, Record<string, unknown> | null>;

function resolveColValue(colNode: any, ctx: RowContext): unknown {
  const tableName = getTableName(colNode.table);
  const meta = SCHEMA_META.bySqlName.get(tableName);
  const row = ctx.get(tableName);
  if (!row || !meta) return undefined;
  const colMeta = meta.bySqlName.get(colNode.name);
  return colMeta ? row[colMeta.jsKey] : row[colNode.name];
}

function resolveBySqlIdentifier(colName: string, ctx: RowContext): unknown {
  for (const [tableName, row] of ctx.entries()) {
    if (!row) continue;
    const meta = SCHEMA_META.bySqlName.get(tableName);
    const colMeta = meta?.bySqlName.get(colName);
    if (colMeta) return row[colMeta.jsKey];
    if (colName in row) return row[colName];
  }
  return undefined;
}

function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : new Date(String(a)).getTime();
    const tb = b instanceof Date ? b.getTime() : new Date(String(b)).getTime();
    return ta === tb ? 0 : ta < tb ? -1 : 1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b ? 0 : a < b ? -1 : 1;
  }
  const sa = String(a);
  const sb = String(b);
  return sa === sb ? 0 : sa < sb ? -1 : 1;
}

function matchLikePattern(val: unknown, pattern: string, caseInsensitive: boolean): boolean {
  if (val === null || val === undefined) return false;
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexStr = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$';
  const re = new RegExp(regexStr, caseInsensitive ? 'i' : '');
  return re.test(String(val));
}

function unwrapVal(node: any): unknown {
  if (isParamObj(node)) return node.value;
  if (Array.isArray(node)) return node.map(unwrapVal);
  return node;
}

export function evaluateSqlCondition(expr: unknown, ctx: RowContext): boolean {
  if (!expr) return true;
  if (!isSqlObj(expr)) return Boolean(expr);

  const chunks = (expr as any).queryChunks as any[];
  const meaningful = chunks.filter(
    (c) => !(isStringChunk(c) && c.value.every((s: string) => s === ''))
  );

  if (meaningful.length === 0) return true;

  // Unwrap single nested SQL node (e.g., `and(...conditions)` with 1 condition)
  if (meaningful.length === 1 && isSqlObj(meaningful[0])) {
    return evaluateSqlCondition(meaningful[0], ctx);
  }

  // Handle `not (...)`
  if (
    meaningful.length === 3 &&
    isStringChunk(meaningful[0]) &&
    meaningful[0].value.join('').trim().toLowerCase() === 'not (' &&
    isSqlObj(meaningful[1])
  ) {
    return !evaluateSqlCondition(meaningful[1], ctx);
  }

  // Check for single raw string chunk like `false`, `true`, `owner_uid IS NULL` or `owner_uid IS NOT NULL`
  if (meaningful.length === 1 && isStringChunk(meaningful[0])) {
    const text = meaningful[0].value.join('').trim();
    if (/^false$/i.test(text)) return false;
    if (/^true$/i.test(text)) return true;
    const nullMatch = /^([a-zA-Z0-9_]+)\s+is\s+(not\s+)?null$/i.exec(text);
    if (nullMatch) {
      const val = resolveBySqlIdentifier(nullMatch[1], ctx);
      const isNotNull = Boolean(nullMatch[2]);
      return isNotNull ? val !== null && val !== undefined : val === null || val === undefined;
    }
    return true;
  }

  // Unwrap parenthesized AND / OR wrapper: [StringChunk('('), innerSQL, StringChunk(')')]
  if (
    meaningful.length === 3 &&
    isStringChunk(meaningful[0]) &&
    meaningful[0].value.join('').trim() === '(' &&
    isSqlObj(meaningful[1]) &&
    isStringChunk(meaningful[2]) &&
    meaningful[2].value.join('').trim() === ')'
  ) {
    return evaluateSqlCondition(meaningful[1], ctx);
  }

  // Check for top-level AND / OR combinator inside chunks
  let hasAnd = false;
  let hasOr = false;
  for (const c of meaningful) {
    if (isStringChunk(c)) {
      const txt = c.value.join('').toLowerCase();
      if (/\band\b/.test(txt)) hasAnd = true;
      if (/\bor\b/.test(txt)) hasOr = true;
    }
  }

  if (hasAnd || hasOr) {
    // Split on ' and ' or ' or '
    const operator = hasOr && !hasAnd ? 'or' : 'and';
    const subExprs = meaningful.filter((c) => !isStringChunk(c));
    if (operator === 'and') {
      return subExprs.every((sub) => evaluateSqlCondition(sub, ctx));
    }
    return subExprs.some((sub) => evaluateSqlCondition(sub, ctx));
  }

  // Binary / unary column expressions: [Col, StringChunk(op), rhs?]
  const first = meaningful[0];
  const second = meaningful[1];
  const third = meaningful[2];

  if (isColumnObj(first) && isStringChunk(second)) {
    const leftVal = resolveColValue(first, ctx);
    const op = second.value.join('').trim().toLowerCase();

    if (op === 'is null') return leftVal === null || leftVal === undefined;
    if (op === 'is not null') return leftVal !== null && leftVal !== undefined;

    const rightVal = isColumnObj(third) ? resolveColValue(third, ctx) : unwrapVal(third);

    switch (op) {
      case '=':
        if (leftVal instanceof Date && rightVal instanceof Date) {
          return leftVal.getTime() === rightVal.getTime();
        }
        return leftVal === rightVal;
      case '<>':
      case '!=':
        return leftVal !== rightVal;
      case '<':
        return compareValues(leftVal, rightVal) < 0;
      case '<=':
        return compareValues(leftVal, rightVal) <= 0;
      case '>':
        return compareValues(leftVal, rightVal) > 0;
      case '>=':
        return compareValues(leftVal, rightVal) >= 0;
      case 'ilike':
        return matchLikePattern(leftVal, String(rightVal ?? ''), true);
      case 'like':
        return matchLikePattern(leftVal, String(rightVal ?? ''), false);
      case 'in': {
        const arr = Array.isArray(rightVal) ? rightVal : [];
        if (arr.length === 0) return false;
        return arr.includes(leftVal);
      }
      case 'not in': {
        const arr = Array.isArray(rightVal) ? rightVal : [];
        if (arr.length === 0) return true;
        return !arr.includes(leftVal);
      }
      default:
        break;
    }
  }

  return true;
}

function parseOrderSpecs(orderArgs: any[]): Array<{ colNode: any; dir: 'asc' | 'desc' }> {
  const flat = orderArgs.flat();
  const specs: Array<{ colNode: any; dir: 'asc' | 'desc' }> = [];
  for (const item of flat) {
    if (!item) continue;
    if (isColumnObj(item)) {
      specs.push({ colNode: item, dir: 'asc' });
      continue;
    }
    if (isSqlObj(item)) {
      const chunks = (item as any).queryChunks as any[];
      const colNode = chunks.find(isColumnObj);
      const dirChunk = chunks.find((c) => isStringChunk(c) && /asc|desc/i.test(c.value.join('')));
      const dir = dirChunk && /desc/i.test(dirChunk.value.join('')) ? 'desc' : 'asc';
      if (colNode) specs.push({ colNode, dir });
    }
  }
  return specs;
}

function projectRow(
  projection: Record<string, any> | null | undefined,
  baseTableSqlName: string,
  ctx: RowContext
): Record<string, unknown> {
  if (!projection) {
    return structuredClone(ctx.get(baseTableSqlName) ?? {});
  }
  const out: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(projection)) {
    if (isColumnObj(spec)) {
      const val = resolveColValue(spec, ctx);
      out[key] = val === undefined ? null : structuredClone(val);
    } else if (spec && typeof spec === 'object') {
      // Nested table object (e.g., { league: leagues, role: leagueMembers.role })
      let nestedTableName: string | null = null;
      try {
        nestedTableName = getTableName(spec as PgTable);
      } catch {
        nestedTableName = null;
      }
      if (nestedTableName && SCHEMA_META.bySqlName.has(nestedTableName)) {
        const row = ctx.get(nestedTableName);
        out[key] = row ? structuredClone(row) : null;
      } else {
        out[key] = projectRow(spec, baseTableSqlName, ctx);
      }
    }
  }
  return out;
}

function toSnakeCaseRow(meta: TableMeta, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of meta.columns) {
    out[col.sqlName] = row[col.jsKey] ?? null;
  }
  return out;
}

export interface DrizzleStoreOptions {
  persistPath?: string | null;
  enableFirestoreSync?: boolean;
}

export class DrizzleStore {
  private tables = new Map<string, Record<string, unknown>[]>();
  private counters = new Map<string, number>();
  private persistPath: string | null;
  private enableFirestoreSync: boolean;
  private txQueue: Promise<void> = Promise.resolve();
  private inTransaction = false;
  private pendingTables = new Set<string>();
  private pendingLeagueIds = new Set<number>();

  constructor(options: DrizzleStoreOptions = {}) {
    this.persistPath =
      options.persistPath !== undefined
        ? options.persistPath
        : path.resolve(process.cwd(), '.cm27-db.json');
    this.enableFirestoreSync = options.enableFirestoreSync ?? true;

    for (const meta of SCHEMA_META.bySqlName.values()) {
      this.tables.set(meta.sqlName, []);
      this.counters.set(meta.sqlName, 0);
    }

    this.loadFromDisk();
  }

  private loadFromDisk() {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      if (!raw.trim()) return;
      const parsed = JSON.parse(raw) as PersistedTablesPayload;
      this.mergeExternalPayload(parsed);
    } catch (err) {
      console.warn('[DrizzleStore] Failed to load local store snapshot:', err);
    }
  }

  public mergeExternalPayload(payload: Partial<PersistedTablesPayload>) {
    if (payload.counters) {
      for (const [k, v] of Object.entries(payload.counters)) {
        const cur = this.counters.get(k) ?? 0;
        if (Number(v) > cur) this.counters.set(k, Number(v));
      }
    }
    if (payload.tables) {
      for (const [tableName, rows] of Object.entries(payload.tables)) {
        const meta = SCHEMA_META.bySqlName.get(tableName);
        if (!meta || !Array.isArray(rows)) continue;
        const revived = rows.map((r) => this.reviveRow(meta, r));
        this.tables.set(tableName, revived);
        const serialCol = meta.columns.find((c) => c.isSerial);
        if (serialCol) {
          let maxId = this.counters.get(tableName) ?? 0;
          for (const row of revived) {
            const idVal = Number(row[serialCol.jsKey]);
            if (Number.isFinite(idVal) && idVal > maxId) maxId = idVal;
          }
          this.counters.set(tableName, maxId);
        }
      }
    }
  }

  public mergeHydratedLeague(
    leagueRow: Record<string, unknown>,
    sections: Record<string, Record<string, unknown[]>>
  ) {
    const leagueMeta = SCHEMA_META.bySqlName.get('leagues');
    if (!leagueMeta) return;
    const lid = Number(leagueRow.id);
    if (!lid) return;

    const leagueRows = this.tables.get('leagues')!;
    const idx = leagueRows.findIndex((r) => Number(r.id) === lid);
    const revivedLeague = this.reviveRow(leagueMeta, leagueRow);
    if (idx >= 0) leagueRows[idx] = revivedLeague;
    else leagueRows.push(revivedLeague);
    this.counters.set('leagues', Math.max(this.counters.get('leagues') ?? 0, lid));

    for (const tableMap of Object.values(sections)) {
      for (const [tName, rows] of Object.entries(tableMap)) {
        const meta = SCHEMA_META.bySqlName.get(tName);
        if (!meta || !Array.isArray(rows)) continue;
        const existing = (this.tables.get(tName) || []).filter(
          (r) => Number(r.leagueId) !== lid
        );
        const revived = rows.map((r) => this.reviveRow(meta, r as Record<string, unknown>));
        const serialCol = meta.columns.find((c) => c.isSerial);
        if (serialCol) {
          let maxId = this.counters.get(tName) ?? 0;
          for (const r of revived) {
            const idVal = Number(r[serialCol.jsKey]);
            if (Number.isFinite(idVal) && idVal > maxId) maxId = idVal;
          }
          this.counters.set(tName, maxId);
        }
        this.tables.set(tName, [...existing, ...revived]);
      }
    }
    this.saveToDisk();
  }

  public mergeHydratedUserAndProfile(
    userRow: Record<string, unknown> | null,
    profileRow: Record<string, unknown> | null
  ) {
    if (userRow && userRow.uid) {
      const meta = SCHEMA_META.bySqlName.get('users')!;
      const arr = this.tables.get('users')!;
      const revived = this.reviveRow(meta, userRow);
      const idx = arr.findIndex((u) => u.uid === revived.uid);
      if (idx >= 0) arr[idx] = revived;
      else arr.push(revived);
      this.counters.set('users', Math.max(this.counters.get('users') ?? 0, Number(revived.id) || 0));
    }
    if (profileRow && profileRow.userUid) {
      const meta = SCHEMA_META.bySqlName.get('manager_profiles')!;
      const arr = this.tables.get('manager_profiles')!;
      const revived = this.reviveRow(meta, profileRow);
      const idx = arr.findIndex((p) => p.userUid === revived.userUid);
      if (idx >= 0) arr[idx] = revived;
      else arr.push(revived);
    }
    this.saveToDisk();
  }

  private reviveRow(meta: TableMeta, raw: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...raw };
    for (const col of meta.columns) {
      const v = out[col.jsKey];
      if (col.isDate && typeof v === 'string') {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) out[col.jsKey] = d;
      }
    }
    return out;
  }

  private buildSnapshotPayload(): PersistedTablesPayload {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters.entries()) counters[k] = v;
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const [k, v] of this.tables.entries()) {
      tables[k] = v.map((r) => ({ ...r }));
    }
    return { counters, tables };
  }

  private saveToDisk() {
    if (!this.persistPath) return;
    try {
      const payload = this.buildSnapshotPayload();
      const tmp = `${this.persistPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(payload), 'utf8');
      fs.renameSync(tmp, this.persistPath);
    } catch (err) {
      console.warn('[DrizzleStore] Failed to write local snapshot:', err);
    }
  }

  private recordMutation(tableName: string, row?: Record<string, unknown>) {
    this.pendingTables.add(tableName);
    if (tableName === 'leagues' && row?.id) {
      this.pendingLeagueIds.add(Number(row.id));
    } else if (row?.leagueId) {
      this.pendingLeagueIds.add(Number(row.leagueId));
    }
  }

  private flushMutations() {
    if (this.inTransaction) return;
    this.saveToDisk();
    if (this.enableFirestoreSync && this.pendingTables.size > 0) {
      const changed = new Set(this.pendingTables);
      const leaguesSet = new Set(this.pendingLeagueIds);
      this.pendingTables.clear();
      this.pendingLeagueIds.clear();
      const snap = this.buildSnapshotPayload();
      void syncSnapshotChangesToFirestore(snap, changed, leaguesSet);
    } else {
      this.pendingTables.clear();
      this.pendingLeagueIds.clear();
    }
  }

  private normalizeInsertRow(meta: TableMeta, input: Record<string, unknown>): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const col of meta.columns) {
      if (col.isSerial && (input[col.jsKey] === undefined || input[col.jsKey] === null)) {
        const nextId = (this.counters.get(meta.sqlName) ?? 0) + 1;
        this.counters.set(meta.sqlName, nextId);
        row[col.jsKey] = nextId;
        continue;
      }

      if (input[col.jsKey] !== undefined) {
        const rawVal = input[col.jsKey];
        if (col.isSerial && typeof rawVal === 'number') {
          this.counters.set(meta.sqlName, Math.max(this.counters.get(meta.sqlName) ?? 0, rawVal));
        }
        row[col.jsKey] =
          col.isDate && typeof rawVal === 'string'
            ? new Date(rawVal)
            : typeof rawVal === 'object' && rawVal !== null && !(rawVal instanceof Date)
              ? structuredClone(rawVal)
              : rawVal;
      } else if (col.hasDefault) {
        if (col.isDate) {
          row[col.jsKey] = new Date();
        } else if (col.defaultVal !== undefined) {
          row[col.jsKey] =
            typeof col.defaultVal === 'object' && col.defaultVal !== null
              ? structuredClone(col.defaultVal)
              : col.defaultVal;
        } else {
          row[col.jsKey] = null;
        }
      } else {
        row[col.jsKey] = null;
      }
    }
    return row;
  }

  private findConflictingRowIndex(
    meta: TableMeta,
    rows: Record<string, unknown>[],
    candidate: Record<string, unknown>,
    explicitTargets?: string[]
  ): number {
    const checkSets = explicitTargets?.length ? [explicitTargets] : meta.uniqueSets;
    for (const keySet of checkSets) {
      const hasNull = keySet.some((k) => candidate[k] === null || candidate[k] === undefined);
      if (hasNull) continue;
      const idx = rows.findIndex((existing) =>
        keySet.every((k) => existing[k] === candidate[k])
      );
      if (idx >= 0) return idx;
    }
    return -1;
  }

  private deleteWithCascades(tableName: string, rowsToDelete: Record<string, unknown>[]) {
    if (rowsToDelete.length === 0) return;
    const meta = SCHEMA_META.bySqlName.get(tableName)!;
    const existing = this.tables.get(tableName)!;
    const delSet = new Set(rowsToDelete);
    this.tables.set(
      tableName,
      existing.filter((r) => !delSet.has(r))
    );
    for (const r of rowsToDelete) this.recordMutation(tableName, r);

    // Propagate foreign keys pointing to this table
    for (const childMeta of SCHEMA_META.bySqlName.values()) {
      for (const fk of childMeta.foreignKeys) {
        if (fk.foreignTable !== tableName) continue;
        const childRows = this.tables.get(childMeta.sqlName)!;
        const matched = childRows.filter((child) =>
          rowsToDelete.some((parent) =>
            fk.cols.every((c, idx) => child[c] !== null && child[c] === parent[fk.foreignCols[idx]])
          )
        );
        if (matched.length === 0) continue;

        if (fk.onDelete === 'cascade') {
          this.deleteWithCascades(childMeta.sqlName, matched);
        } else if (fk.onDelete === 'set null') {
          for (const child of matched) {
            for (const c of fk.cols) child[c] = null;
            this.recordMutation(childMeta.sqlName, child);
          }
        }
      }
    }
  }

  public createDbClient(): any {
    const store = this;

    const buildSelectBuilder = (projection: Record<string, any> | undefined, distinct: boolean) => {
      let baseMeta: TableMeta | null = null;
      const joins: Array<{ type: 'inner' | 'left'; meta: TableMeta; on: unknown }> = [];
      let whereExpr: unknown = null;
      let orderSpecs: Array<{ colNode: any; dir: 'asc' | 'desc' }> = [];
      let limitNum: number | null = null;
      let offsetNum = 0;

      const executeSelect = async () => {
        if (!baseMeta) return [];
        const baseRows = store.tables.get(baseMeta.sqlName) || [];
        let contexts: RowContext[] = baseRows.map((r) => new Map([[baseMeta!.sqlName, r]]));

        for (const j of joins) {
          const joinRows = store.tables.get(j.meta.sqlName) || [];
          const nextContexts: RowContext[] = [];
          for (const ctx of contexts) {
            let matchedAny = false;
            for (const jr of joinRows) {
              const candidate = new Map(ctx);
              candidate.set(j.meta.sqlName, jr);
              if (evaluateSqlCondition(j.on, candidate)) {
                matchedAny = true;
                nextContexts.push(candidate);
              }
            }
            if (!matchedAny && j.type === 'left') {
              const candidate = new Map(ctx);
              candidate.set(j.meta.sqlName, null);
              nextContexts.push(candidate);
            }
          }
          contexts = nextContexts;
        }

        if (whereExpr) {
          contexts = contexts.filter((ctx) => evaluateSqlCondition(whereExpr, ctx));
        }

        if (orderSpecs.length > 0) {
          contexts.sort((a, b) => {
            for (const spec of orderSpecs) {
              const va = resolveColValue(spec.colNode, a);
              const vb = resolveColValue(spec.colNode, b);
              const cmp = compareValues(va, vb);
              if (cmp !== 0) return spec.dir === 'desc' ? -cmp : cmp;
            }
            return 0;
          });
        }

        let projected = contexts.map((ctx) => projectRow(projection, baseMeta!.sqlName, ctx));

        if (distinct) {
          const seen = new Set<string>();
          projected = projected.filter((row) => {
            const key = JSON.stringify(row);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }

        if (offsetNum > 0) projected = projected.slice(offsetNum);
        if (limitNum !== null) projected = projected.slice(0, limitNum);

        return projected;
      };

      const builder: any = {
        from(table: PgTable) {
          baseMeta = SCHEMA_META.byTableObj.get(table) ?? null;
          return builder;
        },
        innerJoin(table: PgTable, on: unknown) {
          const meta = SCHEMA_META.byTableObj.get(table);
          if (meta) joins.push({ type: 'inner', meta, on });
          return builder;
        },
        leftJoin(table: PgTable, on: unknown) {
          const meta = SCHEMA_META.byTableObj.get(table);
          if (meta) joins.push({ type: 'left', meta, on });
          return builder;
        },
        where(cond: unknown) {
          whereExpr = cond;
          return builder;
        },
        orderBy(...args: any[]) {
          orderSpecs = parseOrderSpecs(args);
          return builder;
        },
        limit(n: number) {
          limitNum = n;
          return builder;
        },
        offset(n: number) {
          offsetNum = n;
          return builder;
        },
        then(resolve: any, reject: any) {
          return executeSelect().then(resolve, reject);
        },
        catch(reject: any) {
          return executeSelect().catch(reject);
        },
        finally(cb: any) {
          return executeSelect().finally(cb);
        },
      };
      return builder;
    };

    const buildClient = (): any => ({
      selectDistinct(projection?: Record<string, any>) {
        return buildSelectBuilder(projection, true);
      },

      select(projection?: Record<string, any>) {
        return buildSelectBuilder(projection, false);
      },

      insert(table: PgTable) {
        const meta = SCHEMA_META.byTableObj.get(table)!;
        let pendingValues: Record<string, unknown>[] = [];
        let conflictMode: 'none' | 'nothing' | 'update' = 'none';
        let conflictTargets: string[] = [];
        let conflictSet: Record<string, unknown> = {};
        let returnProjection: Record<string, any> | null | undefined = undefined;
        let wantsReturn = false;

        const executeInsert = async () => {
          if (!meta || pendingValues.length === 0) return [];
          const rows = store.tables.get(meta.sqlName)!;
          const outputRows: Record<string, unknown>[] = [];

          for (const rawInput of pendingValues) {
            const candidate = store.normalizeInsertRow(meta, rawInput);
            const conflictIdx = store.findConflictingRowIndex(
              meta,
              rows,
              candidate,
              conflictTargets
            );

            if (conflictIdx >= 0) {
              if (conflictMode === 'nothing') {
                continue;
              }
              if (conflictMode === 'update') {
                const targetRow = rows[conflictIdx];
                for (const [k, v] of Object.entries(conflictSet)) {
                  if (v !== undefined) {
                    const col = meta.byJsKey.get(k);
                    targetRow[k] =
                      col?.isDate && typeof v === 'string'
                        ? new Date(v)
                        : typeof v === 'object' && v !== null && !(v instanceof Date)
                          ? structuredClone(v)
                          : v;
                  }
                }
                store.recordMutation(meta.sqlName, targetRow);
                outputRows.push(targetRow);
                continue;
              }
              throw new Error(
                `duplicate key value violates unique constraint on "${meta.sqlName}"`
              );
            }

            rows.push(candidate);
            store.recordMutation(meta.sqlName, candidate);
            outputRows.push(candidate);
          }

          store.flushMutations();

          if (!wantsReturn) return [];
          return outputRows.map((r) =>
            projectRow(returnProjection, meta.sqlName, new Map([[meta.sqlName, r]]))
          );
        };

        const builder: any = {
          values(vals: Record<string, unknown> | Record<string, unknown>[]) {
            pendingValues = Array.isArray(vals) ? vals : [vals];
            return builder;
          },
          onConflictDoNothing() {
            conflictMode = 'nothing';
            return builder;
          },
          onConflictDoUpdate(opts: { target: any; set: Record<string, unknown> }) {
            conflictMode = 'update';
            const targets = Array.isArray(opts.target) ? opts.target : [opts.target];
            conflictTargets = targets.map((t: any) => {
              const col = meta.bySqlName.get(t.name);
              return col ? col.jsKey : t.name;
            });
            conflictSet = opts.set || {};
            return builder;
          },
          returning(proj?: Record<string, any>) {
            wantsReturn = true;
            returnProjection = proj;
            return builder;
          },
          then(resolve: any, reject: any) {
            return executeInsert().then(resolve, reject);
          },
          catch(reject: any) {
            return executeInsert().catch(reject);
          },
          finally(cb: any) {
            return executeInsert().finally(cb);
          },
        };
        return builder;
      },

      update(table: PgTable) {
        const meta = SCHEMA_META.byTableObj.get(table)!;
        let patchData: Record<string, unknown> = {};
        let whereExpr: unknown = null;
        let returnProjection: Record<string, any> | null | undefined = undefined;
        let wantsReturn = false;

        const executeUpdate = async () => {
          if (!meta) return [];
          const rows = store.tables.get(meta.sqlName)!;
          const updated: Record<string, unknown>[] = [];
          for (const row of rows) {
            const ctx = new Map<string, Record<string, unknown> | null>([[meta.sqlName, row]]);
            if (!whereExpr || evaluateSqlCondition(whereExpr, ctx)) {
              for (const [k, v] of Object.entries(patchData)) {
                if (v !== undefined) {
                  const col = meta.byJsKey.get(k);
                  row[k] =
                    col?.isDate && typeof v === 'string'
                      ? new Date(v)
                      : typeof v === 'object' && v !== null && !(v instanceof Date)
                        ? structuredClone(v)
                        : v;
                }
              }
              store.recordMutation(meta.sqlName, row);
              updated.push(row);
            }
          }
          if (updated.length > 0) store.flushMutations();
          if (!wantsReturn) return [];
          return updated.map((r) =>
            projectRow(returnProjection, meta.sqlName, new Map([[meta.sqlName, r]]))
          );
        };

        const builder: any = {
          set(data: Record<string, unknown>) {
            patchData = data || {};
            return builder;
          },
          where(cond: unknown) {
            whereExpr = cond;
            return builder;
          },
          returning(proj?: Record<string, any>) {
            wantsReturn = true;
            returnProjection = proj;
            return builder;
          },
          then(resolve: any, reject: any) {
            return executeUpdate().then(resolve, reject);
          },
          catch(reject: any) {
            return executeUpdate().catch(reject);
          },
          finally(cb: any) {
            return executeUpdate().finally(cb);
          },
        };
        return builder;
      },

      delete(table: PgTable) {
        const meta = SCHEMA_META.byTableObj.get(table)!;
        let whereExpr: unknown = null;
        let returnProjection: Record<string, any> | null | undefined = undefined;
        let wantsReturn = false;

        const executeDelete = async () => {
          if (!meta) return [];
          const rows = store.tables.get(meta.sqlName)!;
          const matched = rows.filter((row) =>
            whereExpr
              ? evaluateSqlCondition(whereExpr, new Map([[meta.sqlName, row]]))
              : true
          );
          if (matched.length > 0) {
            store.deleteWithCascades(meta.sqlName, matched);
            store.flushMutations();
          }
          if (!wantsReturn) return [];
          return matched.map((r) =>
            projectRow(returnProjection, meta.sqlName, new Map([[meta.sqlName, r]]))
          );
        };

        const builder: any = {
          where(cond: unknown) {
            whereExpr = cond;
            return builder;
          },
          returning(proj?: Record<string, any>) {
            wantsReturn = true;
            returnProjection = proj;
            return builder;
          },
          then(resolve: any, reject: any) {
            return executeDelete().then(resolve, reject);
          },
          catch(reject: any) {
            return executeDelete().catch(reject);
          },
          finally(cb: any) {
            return executeDelete().finally(cb);
          },
        };
        return builder;
      },

      async execute(sqlExpr: SQL) {
        const chunks = (sqlExpr as any)?.queryChunks || [];
        let fullText = '';
        const params: unknown[] = [];
        for (const c of chunks) {
          if (isStringChunk(c)) {
            fullText += c.value.join('');
          } else {
            params.push(unwrapVal(c));
            fullText += `$${params.length}`;
          }
        }
        const match =
          /SELECT\s+\*\s+FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+(.+?)(?:\s+FOR\s+UPDATE)?\s*;?$/i.exec(
            fullText.trim()
          );
        if (!match) return { rows: [] };
        const tableName = match[1];
        const wherePart = match[2];
        const meta = SCHEMA_META.bySqlName.get(tableName);
        if (!meta) return { rows: [] };

        const clauses = wherePart.split(/\s+AND\s+/i).map((s) => s.trim());
        const filters: Array<{ jsKey: string; value: unknown }> = [];
        for (const cl of clauses) {
          const cm = /^([a-zA-Z0-9_]+)\s*=\s*\$(\d+)$/i.exec(cl);
          if (cm) {
            const colMeta = meta.bySqlName.get(cm[1]);
            const val = params[Number(cm[2]) - 1];
            filters.push({ jsKey: colMeta ? colMeta.jsKey : cm[1], value: val });
          }
        }

        const matched = (store.tables.get(tableName) || []).filter((row) =>
          filters.every((f) => row[f.jsKey] === f.value)
        );
        return { rows: matched.map((r) => toSnakeCaseRow(meta, r)) };
      },

      async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
        let release!: () => void;
        const prev = store.txQueue;
        store.txQueue = new Promise<void>((res) => {
          release = res;
        });
        await prev;

        const backup = store.buildSnapshotPayload();
        store.inTransaction = true;
        try {
          const result = await fn(buildClient());
          store.inTransaction = false;
          store.flushMutations();
          return result;
        } catch (err) {
          store.inTransaction = false;
          store.pendingTables.clear();
          store.pendingLeagueIds.clear();
          store.mergeExternalPayload(backup);
          throw err;
        } finally {
          release();
        }
      },
    });

    return buildClient();
  }
}
