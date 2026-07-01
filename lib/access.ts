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
  created_at: Date;
};

export type SubjectAccess = {
  subject: SubjectRow;
  as: "teacher" | "student";
};

/** Resolve the viewer's relationship to a subject. Null means no access. */
export async function getSubjectAccess(
  subjectId: number,
  userId: number,
  role: string
): Promise<SubjectAccess | null> {
  if (!Number.isInteger(subjectId)) return null;
  const subject = await q1<SubjectRow>("SELECT * FROM subjects WHERE id = $1", [subjectId]);
  if (!subject) return null;
  if (subject.teacher_id === userId) return { subject, as: "teacher" };
  if (role === "student") {
    const enrollment = await q1(
      "SELECT 1 FROM enrollments WHERE subject_id = $1 AND student_id = $2 AND status = 'active'",
      [subjectId, userId]
    );
    if (enrollment) return { subject, as: "student" };
  }
  return null;
}
