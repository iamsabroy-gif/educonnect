import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return NextResponse.json({
      status: "error",
      message: "DATABASE_URL environment variable is not defined or is empty.",
    }, { status: 500 });
  }

  // Parse connection URL safely to hide password
  let parsedUrl = "Unable to parse URL";
  try {
    const urlObj = new URL(url);
    parsedUrl = `${urlObj.protocol}//${urlObj.username}:***@${urlObj.hostname}:${urlObj.port}${urlObj.pathname}`;
  } catch (e) {
    parsedUrl = "Invalid URL format (could not parse as URL)";
  }

  try {
    const isLocal = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({
      connectionString: url,
      max: 1,
      connectionTimeoutMillis: 5000,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });

    const client = await pool.connect();
    const res = await client.query("SELECT NOW() as now, version()");
    client.release();
    await pool.end();

    return NextResponse.json({
      status: "success",
      message: "Database connection successful!",
      databaseInfo: {
        urlMasked: parsedUrl,
        now: res.rows[0].now,
        version: res.rows[0].version,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: "Database connection failed.",
      error: error.message || String(error),
      stack: error.stack,
      databaseInfo: {
        urlMasked: parsedUrl,
      },
    }, { status: 500 });
  }
}
