import { createClient, type Client, type InArgs } from "@libsql/client";
import { hashPassword, generateRoomCode } from "./db-shared";

declare global {
  // eslint-disable-next-line no-var
  var __onlineCoachingSqliteClient: Client | undefined;
  // eslint-disable-next-line no-var
  var __onlineCoachingSqliteInit: Promise<void> | undefined;
}

function getClient(): Client {
  if (globalThis.__onlineCoachingSqliteClient) return globalThis.__onlineCoachingSqliteClient;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Locally: set it to a file: URL (e.g. file:./data/local.db) " +
        "or a real Turso libsql:// URL, alongside TURSO_AUTH_TOKEN."
    );
  }
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  globalThis.__onlineCoachingSqliteClient = client;
  return client;
}

/** Postgres uses $1, $2 placeholders; SQLite's numbered-parameter syntax is ?1, ?2. */
function toSqlitePlaceholders(text: string): string {
  return text.replace(/\$(\d+)/g, "?$1");
}

function normalizeArgs(params: unknown[]): unknown[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

const SCHEMA_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '',
    join_code TEXT NOT NULL UNIQUE,
    approval_required INTEGER NOT NULL DEFAULT FALSE,
    allow_student_threads INTEGER NOT NULL DEFAULT TRUE,
    archived INTEGER NOT NULL DEFAULT FALSE,
    fee_amount REAL,
    fee_upi_id TEXT NOT NULL DEFAULT '',
    fee_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
    fee_paid INTEGER NOT NULL DEFAULT FALSE,
    fee_paid_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (subject_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    edited_at TEXT
  );

  CREATE TABLE IF NOT EXISTS announcement_acks (
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    due_at TEXT NOT NULL,
    max_marks INTEGER,
    late_policy TEXT NOT NULL DEFAULT 'allow_late' CHECK (late_policy IN ('block', 'allow_late')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    file_name TEXT,
    file_data BLOB,
    is_late INTEGER NOT NULL DEFAULT FALSE,
    score REAL,
    feedback TEXT,
    submitted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (assignment_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT FALSE,
    locked INTEGER NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS replies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES replies(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    deleted INTEGER NOT NULL DEFAULT FALSE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS reply_votes (
    reply_id INTEGER NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (reply_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    room_code TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS subject_teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (subject_id, teacher_id)
  );

  CREATE TABLE IF NOT EXISTS call_peers (
    room_code TEXT NOT NULL,
    peer_id TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    PRIMARY KEY (room_code, peer_id)
  );

  CREATE TABLE IF NOT EXISTS call_signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL,
    from_peer TEXT NOT NULL,
    to_peer TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS call_signals_to_idx ON call_signals (room_code, to_peer, id);
`;

async function seed(client: Client) {
  const countRes = await client.execute("SELECT COUNT(*) AS c FROM users");
  if (Number(countRes.rows[0].c) > 0) return;

  const pw = hashPassword("demo1234");
  const insertUser = async (name: string, email: string, role: string) => {
    const r = await client.execute({
      sql: "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id",
      args: [name, email, pw, role],
    });
    return Number(r.rows[0].id);
  };
  const teacherId = await insertUser("Priya Sharma", "teacher@demo.com", "teacher");
  const s1 = await insertUser("Aarav Mehta", "student@demo.com", "student");
  const s2 = await insertUser("Diya Patel", "diya@demo.com", "student");
  const s3 = await insertUser("Rohan Gupta", "rohan@demo.com", "student");

  const subjectRes = await client.execute({
    sql: `INSERT INTO subjects (teacher_id, name, description, category, schedule, join_code)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      teacherId,
      "Mathematics — Class X",
      "Algebra, geometry, and trigonometry for board exam preparation.",
      "Grade 10",
      "Mon / Wed / Fri, 5:00–6:00 PM",
      "MATH42",
    ],
  });
  const subjectId = Number(subjectRes.rows[0].id);

  for (const sid of [s1, s2, s3]) {
    await client.execute({
      sql: "INSERT INTO enrollments (subject_id, student_id, status) VALUES (?, ?, 'active')",
      args: [subjectId, sid],
    });
  }

  await client.execute({
    sql: "INSERT INTO announcements (subject_id, body) VALUES (?, ?)",
    args: [
      subjectId,
      "Welcome to Mathematics Class X! Our first live class is on Friday at 5 PM. Please review Chapter 1 (Real Numbers) beforehand.",
    ],
  });
  await client.execute({
    sql: "INSERT INTO announcements (subject_id, body) VALUES (?, ?)",
    args: [
      subjectId,
      "Reminder: the quadratic equations worksheet is due this Sunday. Submit it under Assignments.",
    ],
  });

  const due = new Date();
  due.setDate(due.getDate() + 4);
  due.setHours(23, 59, 0, 0);
  const assignmentRes = await client.execute({
    sql: `INSERT INTO assignments (subject_id, title, instructions, due_at, max_marks)
          VALUES (?, ?, ?, ?, ?) RETURNING id`,
    args: [
      subjectId,
      "Worksheet 3 — Quadratic Equations",
      "Solve all 12 problems. Show your working for full marks. You may submit a photo of your handwritten work or type your answers.",
      due.toISOString(),
      20,
    ],
  });
  await client.execute({
    sql: "INSERT INTO submissions (assignment_id, student_id, text) VALUES (?, ?, ?)",
    args: [
      Number(assignmentRes.rows[0].id),
      s2,
      "Q1: x = 2, -3. Q2: x = 5 (double root). Q3–Q12 attached in my notebook, will bring to class.",
    ],
  });

  const threadRes = await client.execute({
    sql: "INSERT INTO threads (subject_id, author_id, title, body, pinned) VALUES (?, ?, ?, ?, TRUE) RETURNING id",
    args: [
      subjectId,
      teacherId,
      "Doubts: Chapter 4 — Quadratic Equations",
      "Post any doubts from Chapter 4 here. I'll answer daily, and feel free to help each other.",
    ],
  });
  const threadId = Number(threadRes.rows[0].id);

  const replyRes = await client.execute({
    sql: "INSERT INTO replies (thread_id, author_id, body) VALUES (?, ?, ?) RETURNING id",
    args: [
      threadId,
      s1,
      "Ma'am, in problem 7, how do we know whether to use factoring or the quadratic formula?",
    ],
  });
  await client.execute({
    sql: "INSERT INTO replies (thread_id, author_id, parent_id, body) VALUES (?, ?, ?, ?)",
    args: [
      threadId,
      teacherId,
      Number(replyRes.rows[0].id),
      "Good question! Try factoring first — if you can't spot factors in ~30 seconds, use the formula. The discriminant b²−4ac also tells you if the roots are rational.",
    ],
  });

  const classStart = new Date();
  classStart.setDate(classStart.getDate() + 2);
  classStart.setHours(17, 0, 0, 0);
  await client.execute({
    sql: "INSERT INTO classes (subject_id, title, starts_at, duration_min, room_code) VALUES (?, ?, ?, ?, ?)",
    args: [subjectId, "Live class: Trigonometric Identities", classStart.toISOString(), 60, generateRoomCode()],
  });
}

/**
 * SQLite's CREATE TABLE IF NOT EXISTS only applies to brand-new tables, so
 * columns added to an already-created table (e.g. by a prior deploy) need an
 * explicit ALTER TABLE — vanilla SQLite has no ADD COLUMN IF NOT EXISTS.
 */
async function addColumnIfMissing(
  client: Client,
  table: string,
  column: string,
  columnDef: string
): Promise<void> {
  const info = await client.execute(`PRAGMA table_info(${table})`);
  const exists = info.rows.some((row) => row.name === column);
  if (!exists) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${columnDef}`);
  }
}

async function migrate(client: Client): Promise<void> {
  await addColumnIfMissing(client, "subjects", "fee_amount", "REAL");
  await addColumnIfMissing(client, "subjects", "fee_upi_id", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing(client, "subjects", "fee_note", "TEXT NOT NULL DEFAULT ''");
  await addColumnIfMissing(client, "enrollments", "fee_paid", "INTEGER NOT NULL DEFAULT FALSE");
  await addColumnIfMissing(client, "enrollments", "fee_paid_at", "TEXT");
}

/** Idempotent schema + seed, run once per process before the first query. */
function ensureDb(): Promise<void> {
  if (!globalThis.__onlineCoachingSqliteInit) {
    const client = getClient();
    globalThis.__onlineCoachingSqliteInit = (async () => {
      await client.executeMultiple(SCHEMA_SQL);
      await migrate(client);
      await seed(client);
    })().catch((err) => {
      console.error("Database initialization failed (ensureDb):", err);
      globalThis.__onlineCoachingSqliteInit = undefined; // allow retry on next request
      throw err;
    });
  }
  return globalThis.__onlineCoachingSqliteInit;
}

export async function sqliteQuery<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureDb();
  const client = getClient();
  const result = await client.execute({
    sql: toSqlitePlaceholders(text),
    args: normalizeArgs(params) as InArgs,
  });
  // libSQL rows are array-like hybrids, not plain objects — convert so they
  // can be serialized/passed to Client Components like any other query result.
  return result.rows.map((row) => {
    const plain: Record<string, unknown> = {};
    for (const col of result.columns) plain[col] = row[col];
    return plain;
  }) as unknown as T[];
}
