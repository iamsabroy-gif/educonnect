import { Pool } from "pg";
import crypto from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var __educonnectPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __educonnectInit: Promise<void> | undefined;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidate, "hex"));
}

export function generateJoinCode(): string {
  // 6 chars, unambiguous alphabet
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[crypto.randomInt(alphabet.length)];
  }
  return code;
}

/** Unguessable Jitsi room slug for a live class. */
export function generateRoomCode(): string {
  return "educonnect-" + crypto.randomBytes(8).toString("hex");
}

function getPool(): Pool {
  if (globalThis.__educonnectPool) return globalThis.__educonnectPool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally: copy .env.example to .env.local. On Render: add it as an environment variable."
    );
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: 5, // stay well under free-tier connection limits
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  });
  globalThis.__educonnectPool = pool;
  return pool;
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    schedule TEXT NOT NULL DEFAULT '',
    join_code TEXT NOT NULL UNIQUE,
    approval_required BOOLEAN NOT NULL DEFAULT false,
    allow_student_threads BOOLEAN NOT NULL DEFAULT true,
    archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (subject_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS announcement_acks (
    announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    instructions TEXT NOT NULL DEFAULT '',
    due_at TIMESTAMPTZ NOT NULL,
    max_marks INTEGER,
    late_policy TEXT NOT NULL DEFAULT 'allow_late' CHECK (late_policy IN ('block', 'allow_late')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL DEFAULT '',
    file_name TEXT,
    file_data BYTEA,
    is_late BOOLEAN NOT NULL DEFAULT false,
    score REAL,
    feedback TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assignment_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS threads (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    pinned BOOLEAN NOT NULL DEFAULT false,
    locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS replies (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES users(id),
    parent_id INTEGER REFERENCES replies(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS reply_votes (
    reply_id INTEGER NOT NULL REFERENCES replies(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (reply_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 60,
    room_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_code TEXT;

  UPDATE classes SET room_code = 'educonnect-' || substr(md5(random()::text), 1, 16)
  WHERE room_code IS NULL;
`;

async function seed(pool: Pool) {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM users");
  if (rows[0].c > 0) return;

  const pw = hashPassword("demo1234");
  const insertUser = async (name: string, email: string, role: string) => {
    const r = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
      [name, email, pw, role]
    );
    return r.rows[0].id as number;
  };
  const teacherId = await insertUser("Priya Sharma", "teacher@demo.com", "teacher");
  const s1 = await insertUser("Aarav Mehta", "student@demo.com", "student");
  const s2 = await insertUser("Diya Patel", "diya@demo.com", "student");
  const s3 = await insertUser("Rohan Gupta", "rohan@demo.com", "student");

  const subjectRes = await pool.query(
    `INSERT INTO subjects (teacher_id, name, description, category, schedule, join_code)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      teacherId,
      "Mathematics — Class X",
      "Algebra, geometry, and trigonometry for board exam preparation.",
      "Grade 10",
      "Mon / Wed / Fri, 5:00–6:00 PM",
      "MATH42",
    ]
  );
  const subjectId = subjectRes.rows[0].id as number;

  for (const sid of [s1, s2, s3]) {
    await pool.query(
      "INSERT INTO enrollments (subject_id, student_id, status) VALUES ($1, $2, 'active')",
      [subjectId, sid]
    );
  }

  await pool.query("INSERT INTO announcements (subject_id, body) VALUES ($1, $2)", [
    subjectId,
    "Welcome to Mathematics Class X! Our first live class is on Friday at 5 PM. Please review Chapter 1 (Real Numbers) beforehand.",
  ]);
  await pool.query("INSERT INTO announcements (subject_id, body) VALUES ($1, $2)", [
    subjectId,
    "Reminder: the quadratic equations worksheet is due this Sunday. Submit it under Assignments.",
  ]);

  const due = new Date();
  due.setDate(due.getDate() + 4);
  due.setHours(23, 59, 0, 0);
  const assignmentRes = await pool.query(
    `INSERT INTO assignments (subject_id, title, instructions, due_at, max_marks)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      subjectId,
      "Worksheet 3 — Quadratic Equations",
      "Solve all 12 problems. Show your working for full marks. You may submit a photo of your handwritten work or type your answers.",
      due.toISOString(),
      20,
    ]
  );
  await pool.query(
    "INSERT INTO submissions (assignment_id, student_id, text) VALUES ($1, $2, $3)",
    [
      assignmentRes.rows[0].id,
      s2,
      "Q1: x = 2, -3. Q2: x = 5 (double root). Q3–Q12 attached in my notebook, will bring to class.",
    ]
  );

  const threadRes = await pool.query(
    "INSERT INTO threads (subject_id, author_id, title, body, pinned) VALUES ($1, $2, $3, $4, true) RETURNING id",
    [
      subjectId,
      teacherId,
      "Doubts: Chapter 4 — Quadratic Equations",
      "Post any doubts from Chapter 4 here. I'll answer daily, and feel free to help each other.",
    ]
  );
  const threadId = threadRes.rows[0].id as number;

  const replyRes = await pool.query(
    "INSERT INTO replies (thread_id, author_id, body) VALUES ($1, $2, $3) RETURNING id",
    [
      threadId,
      s1,
      "Ma'am, in problem 7, how do we know whether to use factoring or the quadratic formula?",
    ]
  );
  await pool.query(
    "INSERT INTO replies (thread_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4)",
    [
      threadId,
      teacherId,
      replyRes.rows[0].id,
      "Good question! Try factoring first — if you can't spot factors in ~30 seconds, use the formula. The discriminant b²−4ac also tells you if the roots are rational.",
    ]
  );

  const classStart = new Date();
  classStart.setDate(classStart.getDate() + 2);
  classStart.setHours(17, 0, 0, 0);
  await pool.query(
    "INSERT INTO classes (subject_id, title, starts_at, duration_min, room_code) VALUES ($1, $2, $3, $4, $5)",
    [
      subjectId,
      "Live class: Trigonometric Identities",
      classStart.toISOString(),
      60,
      generateRoomCode(),
    ]
  );
}

/** Idempotent schema + seed, run once per process before the first query. */
function ensureDb(): Promise<void> {
  if (!globalThis.__educonnectInit) {
    const pool = getPool();
    globalThis.__educonnectInit = (async () => {
      await pool.query(SCHEMA_SQL);
      await seed(pool);
    })().catch((err) => {
      globalThis.__educonnectInit = undefined; // allow retry on next request
      throw err;
    });
  }
  return globalThis.__educonnectInit;
}

/** Run a query, returning all rows. */
export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureDb();
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

/** Run a query, returning the first row or undefined. */
export async function q1<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await q<T>(text, params);
  return rows[0];
}
