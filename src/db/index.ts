import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { DrizzleStore } from './drizzleStore.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _cm27DrizzleStore: DrizzleStore | undefined;
}

export const isPostgresConfigured = Boolean(
  process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME
);

export const isFirestoreConfigured = Boolean(
  firebaseConfig?.projectId && firebaseConfig?.firestoreDatabaseId
);

export const isDatabaseConfigured = isPostgresConfigured || isFirestoreConfigured;

export const createPool = () => {
  if (!isPostgresConfigured) {
    return null;
  }
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export function getFirestoreDrizzleStore(): DrizzleStore {
  if (!global._cm27DrizzleStore) {
    global._cm27DrizzleStore = new DrizzleStore();
  }
  return global._cm27DrizzleStore;
}

const pool = createPool();

export const db: ReturnType<typeof drizzle<typeof schema>> = pool
  ? drizzle(pool, { schema })
  : (getFirestoreDrizzleStore().createDbClient() as ReturnType<typeof drizzle<typeof schema>>);
