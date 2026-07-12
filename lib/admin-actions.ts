"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q, q1 } from "./db";
import { requireAdminSession } from "./admin-auth";

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

export async function adminAddStudent(formData: FormData) {
  await requireAdminSession();
  const subjectId = num(formData, "subject_id");
  const email = str(formData, "email").toLowerCase();
  const student = await q1<{ id: number }>(
    "SELECT id FROM users WHERE email = $1 AND role = 'student'",
    [email]
  );
  if (!student) {
    redirect(`/admin/subjects/${subjectId}?error=notfound`);
  }
  await q(
    `INSERT INTO enrollments (subject_id, student_id, status) VALUES ($1, $2, 'active')
     ON CONFLICT (subject_id, student_id) DO UPDATE SET status = 'active'`,
    [subjectId, student!.id]
  );
  revalidatePath(`/admin/subjects/${subjectId}`);
}

export async function adminSetEnrollmentStatus(formData: FormData) {
  await requireAdminSession();
  const enrollmentId = num(formData, "enrollment_id");
  const decision = str(formData, "decision"); // approve | reject | remove
  const subjectId = num(formData, "subject_id");
  if (decision === "approve") {
    await q("UPDATE enrollments SET status = 'active' WHERE id = $1", [enrollmentId]);
  } else {
    await q("DELETE FROM enrollments WHERE id = $1", [enrollmentId]);
  }
  revalidatePath(`/admin/subjects/${subjectId}`);
}

export async function adminReassignTeacher(formData: FormData) {
  await requireAdminSession();
  const subjectId = num(formData, "subject_id");
  const teacherId = num(formData, "teacher_id");
  const teacher = await q1<{ id: number }>(
    "SELECT id FROM users WHERE id = $1 AND role = 'teacher'",
    [teacherId]
  );
  if (!teacher) {
    redirect(`/admin/subjects/${subjectId}?error=invalidteacher`);
  }
  await q("UPDATE subjects SET teacher_id = $1 WHERE id = $2", [teacherId, subjectId]);
  revalidatePath("/admin/subjects");
  redirect(`/admin/subjects/${subjectId}?reassigned=1`);
}
