import { q1 } from "./db";

export type SubjectRow = {
  id: number;
  teacher_id: number;
  name: string;
  description: string;
  category: string;
  schedule: string;
  join_code: string;
  approval_required: boolean;
  allow_student_threads: boolean;
  archived: boolean;
  fee_amount: number | null;
  fee_upi_id: string;
  fee_note: string;
  created_at: Date;
};

export type SubjectAccess = {
  subject: SubjectRow;
  as: "teacher" | "student";
};

export type ClassRow = {
  id: number;
  subject_id: number;
  title: string;
  starts_at: Date | string;
  duration_min: number;
};

/**
 * Resolve a video room code to its class and the viewer's subject access.
 * Null means the room doesn't exist or the viewer isn't part of the subject.
 */
export async function getRoomAccess(
  roomCode: string,
  userId: number,
  role: string
): Promise<{ cls: ClassRow; access: SubjectAccess } | null> {
  if (!roomCode) return null;
  const cls = await q1<ClassRow>(
    "SELECT id, subject_id, title, starts_at, duration_min FROM classes WHERE room_code = $1",
    [roomCode]
  );
  if (!cls) return null;
  const access = await getSubjectAccess(cls.subject_id, userId, role);
  if (!access) return null;
  return { cls, access };
}

/** Resolve the viewer's relationship to a subject. Null means no access. */
export async function getSubjectAccess(
  subjectId: number,
  userId: number,
  role: string
): Promise<SubjectAccess | null> {
  if (!Number.isInteger(subjectId)) return null;
  const subject = await q1<SubjectRow>("SELECT * FROM subjects WHERE id = $1", [subjectId]);
  if (!subject) return null;
  // Postgres NUMERIC arrives as a string via `pg` (SQLite REAL is already a
  // number) — normalize so callers can safely do arithmetic and .toFixed().
  subject.fee_amount = subject.fee_amount == null ? null : Number(subject.fee_amount);
  if (subject.teacher_id === userId) return { subject, as: "teacher" };
  const coTeacher = await q1(
    "SELECT 1 FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2 AND status = 'active'",
    [subjectId, userId]
  );
  if (coTeacher) return { subject, as: "teacher" };
  if (role === "student") {
    const enrollment = await q1(
      "SELECT 1 FROM enrollments WHERE subject_id = $1 AND student_id = $2 AND status = 'active'",
      [subjectId, userId]
    );
    if (enrollment) return { subject, as: "student" };
  }
  return null;
}
