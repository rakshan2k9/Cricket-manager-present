import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const isDatabaseConfigured = Boolean(
  process.env.SQL_HOST && process.env.SQL_USER && process.env.SQL_DB_NAME
);

export const createPool = () => {
  if (!isDatabaseConfigured) {
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

function createMockDb(): ReturnType<typeof drizzle<typeof schema>> {
  const createChainableQuery = (defaultResult: unknown = []): unknown => {
    const resolved = Promise.resolve(defaultResult);
    const proxy: unknown = new Proxy(() => createChainableQuery(defaultResult), {
      get(_target, prop) {
        if (prop === 'then') return resolved.then.bind(resolved);
        if (prop === 'catch') return resolved.catch.bind(resolved);
        if (prop === 'finally') return resolved.finally.bind(resolved);
        if (prop === Symbol.toStringTag) return 'Promise';
        return () => proxy;
      },
    });
    return proxy;
  };

  const queryTableStub = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
  };

  const mockDb: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'query') {
          return new Proxy({}, { get: () => queryTableStub });
        }
        if (prop === 'transaction') {
          return async (cb: (tx: unknown) => Promise<unknown>) => cb(mockDb);
        }
        if (prop === 'execute') {
          return async () => ({ rows: [] });
        }
        return () => createChainableQuery([]);
      },
    }
  );

  return mockDb as ReturnType<typeof drizzle<typeof schema>>;
}

const pool = createPool();

if (!pool) {
  console.warn(
    '[AI Studio] Cloud SQL is not configured (SQL_HOST missing) — using in-memory database mock.'
  );
}

export const db = pool ? drizzle(pool, { schema }) : createMockDb();

