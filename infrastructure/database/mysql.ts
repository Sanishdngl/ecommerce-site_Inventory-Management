import * as mysql from "mysql2/promise";

// Query functions accept either a pool or a checked-out connection — the
// latter is what withTransaction() passes in, so a single query function
// works both standalone and inside a transaction without duplicating code.
export type DbClient = mysql.Pool | mysql.PoolConnection;

let pool: mysql.Pool | null = null;

export function getDb(): mysql.Pool {
  if (pool) return pool;

  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

  if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
    throw new Error("Missing required database environment variables");
  }

  pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT ? parseInt(DB_PORT, 10) : 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: "Z", //timestamps as UTC
  });

  return pool;
}

export async function testDbConnection(): Promise<void> {
  const db = getDb();
  const conn = await db.getConnection();
  await conn.ping();
  conn.release();
}

// No transaction helper existed anywhere in the codebase before this —
// every write below was a single statement. The outbox pattern requires
// the business write and its outbox row to commit atomically, so this is
// now required for any handler that writes an outbox event.
export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const db = getDb();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
