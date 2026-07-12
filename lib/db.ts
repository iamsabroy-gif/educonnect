export { hashPassword, verifyPassword, generateJoinCode, generateRoomCode } from "./db-shared";

/**
 * Driver toggle: DB_DRIVER=postgres (default) uses Neon/Postgres via `pg`;
 * DB_DRIVER=turso uses Turso/SQLite via @libsql/client. Switching requires
 * setting the corresponding connection env vars (DATABASE_URL, or
 * TURSO_DATABASE_URL/TURSO_AUTH_TOKEN) and a redeploy/restart — this is not
 * a live in-app switch.
 */
function driver(): "postgres" | "turso" {
  return process.env.DB_DRIVER === "turso" ? "turso" : "postgres";
}

/** Run a query, returning all rows. */
export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    if (driver() === "turso") {
      const { sqliteQuery } = await import("./db-sqlite");
      return await sqliteQuery<T>(text, params);
    }
    const { pgQuery } = await import("./db-postgres");
    return await pgQuery<T>(text, params);
  } catch (err) {
    console.error(`Database query failed: "${text}" with params ${JSON.stringify(params)}:`, err);
    throw err;
  }
}

/** Run a query, returning the first row or undefined. */
export async function q1<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}
