import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import { getFirestoreDrizzleStore, isPostgresConfigured } from '../db/index.ts';
import { fetchUserAndLeaguesFromFirestore, runWithAuthContext } from '../db/firestoreSync.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  idToken?: string;
}

const hydratedUids = new Set<string>();

async function ensureUserHydrated(uid: string, idToken: string) {
  if (isPostgresConfigured || hydratedUids.has(uid)) return;
  hydratedUids.add(uid);
  try {
    const store = getFirestoreDrizzleStore();
    const data = await fetchUserAndLeaguesFromFirestore(uid, idToken);
    store.mergeHydratedUserAndProfile(data.user, data.profile);
    for (const item of data.leagues) {
      store.mergeHydratedLeague(item.league, item.sections);
    }
  } catch (err) {
    console.warn('[FirestoreHydrate] Non-fatal hydration warning:', err);
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    req.idToken = token;

    await runWithAuthContext({ uid: decodedToken.uid, idToken: token }, async () => {
      await ensureUserHydrated(decodedToken.uid, token);
      await getOrCreateUser(decodedToken.uid, decodedToken.email || '');
      next();
    });
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
};
