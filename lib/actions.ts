"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { q, q1, hashPassword, verifyPassword, generateJoinCode, generateRoomCode } from "./db";
import { createSession, destroySession, requireUser } from "./auth";
import { getSubjectAccess as subjectAccess } from "./access";
import { compressBuffer } from "./compression";
import { isValidUpiId } from "./upi";
import { sendMail, buildWelcomeEmail, buildClassScheduledEmail } from "./email";
import {
  verifyAdminCredentials,
  createAdminSession,
  destroyAdminSession,
} from "./admin-auth";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string): number {
  return Number(formData.get(key));
}

// ---------- Auth ----------

export async function signup(formData: FormData) {
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = str(formData, "role") === "teacher" ? "teacher" : "student";

  if (!name || !email || password.length < 8) {
    redirect("/signup?error=invalid");
  }
  const existing = await q1("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) redirect("/signup?error=exists");

  const row = await q1<{ id: number }>(
    "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id",
    [name, email, hashPassword(password), role]
  );
  await q("UPDATE users SET last_login_at = $2 WHERE id = $1", [row!.id, new Date().toISOString()]);
  await createSession(row!.id);

  // Fire-and-forget welcome email — never blocks the redirect
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  sendMail({
    to: email,
    subject: "Welcome to EduConnect! 🎉",
    html: buildWelcomeEmail({
      name,
      email,
      role,
      dashboardUrl: `${baseUrl}/dashboard`,
    }),
  });

  redirect("/dashboard?welcome=1");
}

export async function login(formData: FormData) {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await q1<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email]
  );
  if (!user || !verifyPassword(password, user.password_hash)) {
    redirect("/login?error=1");
  }
  await q("UPDATE users SET last_login_at = $2 WHERE id = $1", [user!.id, new Date().toISOString()]);
  await createSession(user!.id);
  redirect("/dashboard?welcome=1");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- Admin auth (static credentials, independent of the users table) ----------

export async function adminLogin(formData: FormData) {
  const username = str(formData, "username");
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminCredentials(username, password)) {
    redirect("/admin/login?error=1");
  }
  await createAdminSession();
  redirect("/admin");
}

export async function adminLogout() {
  await destroyAdminSession();
  redirect("/admin/login");
}

// ---------- Subjects & enrollment ----------

async function uniqueJoinCode(): Promise<string> {
  let code = generateJoinCode();
  while (await q1("SELECT id FROM subjects WHERE join_code = $1", [code])) {
    code = generateJoinCode();
  }
  return code;
}

export async function createSubject(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "teacher") redirect("/dashboard");
  const name = str(formData, "name");
  if (!name) redirect("/subjects/new?error=1");

  const code = await uniqueJoinCode();
  const row = await q1<{ id: number }>(
    `INSERT INTO subjects (teacher_id, name, description, category, schedule, join_code, approval_required, allow_student_threads)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      user.id,
      name,
      str(formData, "description"),
      str(formData, "category"),
      str(formData, "schedule"),
      code,
      !!formData.get("approval_required"),
      !!formData.get("allow_student_threads"),
    ]
  );

  const coTeacherEmail = str(formData, "co_teacher").toLowerCase();
  if (coTeacherEmail) {
    const coTeacher = await q1<{ id: number }>(
      "SELECT id FROM users WHERE email = $1 AND role = 'teacher'",
      [coTeacherEmail]
    );
    if (coTeacher && coTeacher.id !== user.id) {
      let canSend = true;
      const lastInvite = await q1<{ created_at: string | Date }>(
        "SELECT created_at FROM subject_teachers WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 1",
        [coTeacher.id]
      );
      if (lastInvite) {
        const diffMs = Date.now() - new Date(lastInvite.created_at).getTime();
        if (diffMs < 2 * 60 * 1000) {
          canSend = false;
        }
      }
      if (canSend) {
        await q(
          "INSERT INTO subject_teachers (subject_id, teacher_id, status) VALUES ($1, $2, 'pending')",
          [row!.id, coTeacher.id]
        );
      }
    }
  }

  redirect(`/subjects/${row!.id}`);
}

export async function updateSubject(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") return;

  const feeAmountRaw = str(formData, "fee_amount");
  const feeAmount = feeAmountRaw ? Math.max(0, Number(feeAmountRaw)) : null;
  const feeUpiId = str(formData, "fee_upi_id");
  if (feeUpiId && !isValidUpiId(feeUpiId)) {
    redirect(`/subjects/${subjectId}/settings?error=upi`);
  }

  await q(
    `UPDATE subjects SET name = $1, description = $2, category = $3, schedule = $4,
     approval_required = $5, allow_student_threads = $6, archived = $7,
     fee_amount = $8, fee_upi_id = $9, fee_note = $10 WHERE id = $11`,
    [
      str(formData, "name"),
      str(formData, "description"),
      str(formData, "category"),
      str(formData, "schedule"),
      !!formData.get("approval_required"),
      !!formData.get("allow_student_threads"),
      !!formData.get("archived"),
      feeAmount,
      feeUpiId,
      str(formData, "fee_note"),
      subjectId,
    ]
  );
  revalidatePath(`/subjects/${subjectId}`, "layout");
  redirect(`/subjects/${subjectId}`);
}

export async function setFeePaid(formData: FormData) {
  const user = await requireUser();
  const enrollmentId = num(formData, "enrollment_id");
  const paid = str(formData, "paid") === "1";
  const enrollment = await q1<{ subject_id: number }>(
    "SELECT subject_id FROM enrollments WHERE id = $1",
    [enrollmentId]
  );
  if (!enrollment) return;
  const access = await subjectAccess(enrollment.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  await q(
    "UPDATE enrollments SET fee_paid = $1, fee_paid_at = $2 WHERE id = $3",
    [paid, paid ? new Date().toISOString() : null, enrollmentId]
  );
  revalidatePath(`/subjects/${enrollment.subject_id}/students`);
}

export async function regenerateJoinCode(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") return;
  const code = await uniqueJoinCode();
  await q("UPDATE subjects SET join_code = $1 WHERE id = $2", [code, subjectId]);
  revalidatePath(`/subjects/${subjectId}`, "layout");
}

export async function joinSubject(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "student") redirect("/dashboard");
  const code = str(formData, "code").toUpperCase();
  const subject = await q1<{ id: number; approval_required: boolean; archived: boolean }>(
    "SELECT id, approval_required, archived FROM subjects WHERE join_code = $1",
    [code]
  );
  if (!subject || subject.archived) redirect("/join?error=notfound");

  const existing = await q1<{ id: number; status: string }>(
    "SELECT id, status FROM enrollments WHERE subject_id = $1 AND student_id = $2",
    [subject!.id, user.id]
  );
  if (existing) {
    redirect(existing.status === "active" ? `/subjects/${subject!.id}` : "/join?error=pending");
  }
  const status = subject!.approval_required ? "pending" : "active";
  await q("INSERT INTO enrollments (subject_id, student_id, status) VALUES ($1, $2, $3)", [
    subject!.id,
    user.id,
    status,
  ]);
  redirect(status === "active" ? `/subjects/${subject!.id}` : "/dashboard?joined=pending");
}

export async function addStudentByEmail(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") return;
  const email = str(formData, "email").toLowerCase();
  const student = await q1<{ id: number }>(
    "SELECT id FROM users WHERE email = $1 AND role = 'student'",
    [email]
  );
  if (!student) {
    redirect(`/subjects/${subjectId}/students?error=notfound`);
  }
  await q(
    `INSERT INTO enrollments (subject_id, student_id, status) VALUES ($1, $2, 'active')
     ON CONFLICT (subject_id, student_id) DO UPDATE SET status = 'active'`,
    [subjectId, student!.id]
  );
  revalidatePath(`/subjects/${subjectId}/students`);
}

export async function setEnrollmentStatus(formData: FormData) {
  const user = await requireUser();
  const enrollmentId = num(formData, "enrollment_id");
  const decision = str(formData, "decision"); // approve | reject | remove
  const enrollment = await q1<{ id: number; subject_id: number }>(
    "SELECT id, subject_id FROM enrollments WHERE id = $1",
    [enrollmentId]
  );
  if (!enrollment) return;
  const access = await subjectAccess(enrollment.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  if (decision === "approve") {
    await q("UPDATE enrollments SET status = 'active' WHERE id = $1", [enrollmentId]);
  } else {
    await q("DELETE FROM enrollments WHERE id = $1", [enrollmentId]);
  }
  revalidatePath(`/subjects/${enrollment.subject_id}/students`);
}

export async function leaveSubject(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  await q("DELETE FROM enrollments WHERE subject_id = $1 AND student_id = $2", [
    subjectId,
    user.id,
  ]);
  redirect("/dashboard");
}

// ---------- Announcements ----------

export async function createAnnouncement(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") return;
  const body = str(formData, "body");
  if (!body) return;
  await q("INSERT INTO announcements (subject_id, body) VALUES ($1, $2)", [subjectId, body]);
  revalidatePath(`/subjects/${subjectId}`);
}

export async function updateAnnouncement(formData: FormData) {
  const user = await requireUser();
  const id = num(formData, "announcement_id");
  const row = await q1<{ subject_id: number }>(
    "SELECT subject_id FROM announcements WHERE id = $1",
    [id]
  );
  if (!row) return;
  const access = await subjectAccess(row.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  const body = str(formData, "body");
  if (!body) return;
  await q("UPDATE announcements SET body = $1, edited_at = $3 WHERE id = $2", [
    body,
    id,
    new Date().toISOString(),
  ]);
  revalidatePath(`/subjects/${row.subject_id}`);
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await requireUser();
  const id = num(formData, "announcement_id");
  const row = await q1<{ subject_id: number }>(
    "SELECT subject_id FROM announcements WHERE id = $1",
    [id]
  );
  if (!row) return;
  const access = await subjectAccess(row.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  await q("DELETE FROM announcements WHERE id = $1", [id]);
  revalidatePath(`/subjects/${row.subject_id}`);
}

export async function toggleAck(formData: FormData) {
  const user = await requireUser();
  const id = num(formData, "announcement_id");
  const row = await q1<{ subject_id: number }>(
    "SELECT subject_id FROM announcements WHERE id = $1",
    [id]
  );
  if (!row) return;
  if (!(await subjectAccess(row.subject_id, user.id, user.role))) return;
  const existing = await q1(
    "SELECT 1 FROM announcement_acks WHERE announcement_id = $1 AND user_id = $2",
    [id, user.id]
  );
  if (existing) {
    await q("DELETE FROM announcement_acks WHERE announcement_id = $1 AND user_id = $2", [
      id,
      user.id,
    ]);
  } else {
    await q("INSERT INTO announcement_acks (announcement_id, user_id) VALUES ($1, $2)", [
      id,
      user.id,
    ]);
  }
  revalidatePath(`/subjects/${row.subject_id}`);
}

// ---------- Assignments ----------

export async function createAssignment(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") return;
  const title = str(formData, "title");
  const dueAt = str(formData, "due_at");
  if (!title || !dueAt) return;
  const maxMarksRaw = str(formData, "max_marks");
  const row = await q1<{ id: number }>(
    `INSERT INTO assignments (subject_id, title, instructions, due_at, max_marks, late_policy)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      subjectId,
      title,
      str(formData, "instructions"),
      new Date(dueAt).toISOString(),
      maxMarksRaw ? Number(maxMarksRaw) : null,
      str(formData, "late_policy") === "block" ? "block" : "allow_late",
    ]
  );
  redirect(`/subjects/${subjectId}/assignments/${row!.id}`);
}

export async function submitAssignment(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "student") return;
  const assignmentId = num(formData, "assignment_id");
  const assignment = await q1<{
    id: number;
    subject_id: number;
    due_at: Date;
    late_policy: string;
  }>("SELECT id, subject_id, due_at, late_policy FROM assignments WHERE id = $1", [
    assignmentId,
  ]);
  if (!assignment) return;
  const access = await subjectAccess(assignment.subject_id, user.id, user.role);
  if (access?.as !== "student") return;

  const isLate = new Date() > assignment.due_at;
  if (isLate && assignment.late_policy === "block") {
    redirect(`/subjects/${assignment.subject_id}/assignments/${assignmentId}?error=late`);
  }

  const text = str(formData, "text");
  const file = formData.get("file");
  let fileName: string | null = null;
  let fileData: Buffer | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      redirect(`/subjects/${assignment.subject_id}/assignments/${assignmentId}?error=toobig`);
    }
    fileName = file.name;
    fileData = compressBuffer(Buffer.from(await file.arrayBuffer()));
  }
  if (!text && !fileName) return;

  await q(
    `INSERT INTO submissions (assignment_id, student_id, text, file_name, file_data, is_late, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (assignment_id, student_id) DO UPDATE SET
       text = EXCLUDED.text,
       file_name = COALESCE(EXCLUDED.file_name, submissions.file_name),
       file_data = COALESCE(EXCLUDED.file_data, submissions.file_data),
       is_late = EXCLUDED.is_late,
       submitted_at = EXCLUDED.submitted_at`,
    [assignmentId, user.id, text, fileName, fileData, isLate, new Date().toISOString()]
  );
  revalidatePath(`/subjects/${assignment.subject_id}/assignments/${assignmentId}`);
}

export async function gradeSubmission(formData: FormData) {
  const user = await requireUser();
  const submissionId = num(formData, "submission_id");
  const row = await q1<{ id: number; subject_id: number; assignment_id: number }>(
    `SELECT s.id, a.subject_id, a.id AS assignment_id FROM submissions s
     JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1`,
    [submissionId]
  );
  if (!row) return;
  const access = await subjectAccess(row.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  const scoreRaw = str(formData, "score");
  await q("UPDATE submissions SET score = $1, feedback = $2 WHERE id = $3", [
    scoreRaw ? Number(scoreRaw) : null,
    str(formData, "feedback") || null,
    submissionId,
  ]);
  revalidatePath(`/subjects/${row.subject_id}/assignments/${row.assignment_id}`);
}

// ---------- Discussion forum ----------

export async function createThread(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (!access) return;
  if (access.as === "student" && !access.subject.allow_student_threads) return;
  const title = str(formData, "title");
  if (!title) return;
  const row = await q1<{ id: number }>(
    "INSERT INTO threads (subject_id, author_id, title, body) VALUES ($1, $2, $3, $4) RETURNING id",
    [subjectId, user.id, title, str(formData, "body")]
  );
  redirect(`/subjects/${subjectId}/discussions/${row!.id}`);
}

export async function replyToThread(formData: FormData) {
  const user = await requireUser();
  const threadId = num(formData, "thread_id");
  const thread = await q1<{ id: number; subject_id: number; locked: boolean }>(
    "SELECT id, subject_id, locked FROM threads WHERE id = $1",
    [threadId]
  );
  if (!thread) return;
  const access = await subjectAccess(thread.subject_id, user.id, user.role);
  if (!access) return;
  if (thread.locked && access.as !== "teacher") return;
  const body = str(formData, "body");
  if (!body) return;
  const parentRaw = str(formData, "parent_id");
  await q(
    "INSERT INTO replies (thread_id, author_id, parent_id, body) VALUES ($1, $2, $3, $4)",
    [threadId, user.id, parentRaw ? Number(parentRaw) : null, body]
  );
  revalidatePath(`/subjects/${thread.subject_id}/discussions/${threadId}`);
}

export async function toggleVote(formData: FormData) {
  const user = await requireUser();
  const replyId = num(formData, "reply_id");
  const reply = await q1<{ id: number; thread_id: number; subject_id: number }>(
    "SELECT r.id, r.thread_id, t.subject_id FROM replies r JOIN threads t ON t.id = r.thread_id WHERE r.id = $1",
    [replyId]
  );
  if (!reply) return;
  if (!(await subjectAccess(reply.subject_id, user.id, user.role))) return;
  const existing = await q1("SELECT 1 FROM reply_votes WHERE reply_id = $1 AND user_id = $2", [
    replyId,
    user.id,
  ]);
  if (existing) {
    await q("DELETE FROM reply_votes WHERE reply_id = $1 AND user_id = $2", [replyId, user.id]);
  } else {
    await q("INSERT INTO reply_votes (reply_id, user_id) VALUES ($1, $2)", [replyId, user.id]);
  }
  revalidatePath(`/subjects/${reply.subject_id}/discussions/${reply.thread_id}`);
}

export async function moderateThread(formData: FormData) {
  const user = await requireUser();
  const threadId = num(formData, "thread_id");
  const action = str(formData, "moderation"); // pin | lock | delete
  const thread = await q1<{
    id: number;
    subject_id: number;
    pinned: boolean;
    locked: boolean;
  }>("SELECT id, subject_id, pinned, locked FROM threads WHERE id = $1", [threadId]);
  if (!thread) return;
  const access = await subjectAccess(thread.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  if (action === "pin") {
    await q("UPDATE threads SET pinned = $1 WHERE id = $2", [!thread.pinned, threadId]);
  } else if (action === "lock") {
    await q("UPDATE threads SET locked = $1 WHERE id = $2", [!thread.locked, threadId]);
  } else if (action === "delete") {
    await q("DELETE FROM threads WHERE id = $1", [threadId]);
    redirect(`/subjects/${thread.subject_id}/discussions`);
  }
  revalidatePath(`/subjects/${thread.subject_id}/discussions/${threadId}`);
  revalidatePath(`/subjects/${thread.subject_id}/discussions`);
}

export async function deleteReply(formData: FormData) {
  const user = await requireUser();
  const replyId = num(formData, "reply_id");
  const reply = await q1<{
    id: number;
    author_id: number;
    thread_id: number;
    subject_id: number;
  }>(
    "SELECT r.id, r.author_id, r.thread_id, t.subject_id FROM replies r JOIN threads t ON t.id = r.thread_id WHERE r.id = $1",
    [replyId]
  );
  if (!reply) return;
  const access = await subjectAccess(reply.subject_id, user.id, user.role);
  const canDelete = access?.as === "teacher" || reply.author_id === user.id;
  if (!canDelete) return;
  await q("UPDATE replies SET deleted = true, body = '' WHERE id = $1", [replyId]);
  revalidatePath(`/subjects/${reply.subject_id}/discussions/${reply.thread_id}`);
}

// ---------- Live classes (schedule only; video SDK is a v1.1 integration) ----------

export async function scheduleClass(formData: FormData) {
  const user = await requireUser();
  const subjectId = num(formData, "subject_id");
  const access = await subjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") return;
  const title = str(formData, "title");
  const startsAt = str(formData, "starts_at");
  if (!title || !startsAt) return;
  const newClass = await q1<{ id: number }>(
    "INSERT INTO classes (subject_id, title, starts_at, duration_min, room_code) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [
      subjectId,
      title,
      new Date(startsAt).toISOString(),
      num(formData, "duration_min") || 60,
      generateRoomCode(),
    ]
  );

  const coTeacherEmail = str(formData, "co_teacher").toLowerCase();
  if (coTeacherEmail) {
    const coTeacher = await q1<{ id: number }>(
      "SELECT id FROM users WHERE email = $1 AND role = 'teacher'",
      [coTeacherEmail]
    );
    if (coTeacher && coTeacher.id !== user.id) {
      let canSend = true;
      const lastInvite = await q1<{ created_at: string | Date }>(
        "SELECT created_at FROM subject_teachers WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 1",
        [coTeacher.id]
      );
      if (lastInvite) {
        const diffMs = Date.now() - new Date(lastInvite.created_at).getTime();
        if (diffMs < 2 * 60 * 1000) {
          canSend = false;
        }
      }
      if (canSend) {
        const existing = await q1(
          "SELECT 1 FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2",
          [subjectId, coTeacher.id]
        );
        if (!existing) {
          await q(
            "INSERT INTO subject_teachers (subject_id, teacher_id, status, class_id) VALUES ($1, $2, 'pending', $3)",
            [subjectId, coTeacher.id, newClass!.id]
          );
        }
      }
    }
  }

  // Fire-and-forget class-scheduled emails to all active enrolled students
  (() => {
    q<{ email: string; name: string }>(
      `SELECT u.email, u.name
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE e.subject_id = $1 AND e.status = 'active'`,
      [subjectId]
    ).then(async (students) => {
      if (!students.length) return;
      const subject = await q1<{ name: string }>("SELECT name FROM subjects WHERE id = $1", [subjectId]);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      const startsAtFormatted = new Date(startsAt).toLocaleString("en-IN", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      });
      await Promise.all(
        students.map((s) =>
          sendMail({
            to: s.email,
            subject: `New class scheduled: ${title}`,
            html: buildClassScheduledEmail({
              studentName: s.name,
              subjectName: subject?.name ?? "your subject",
              teacherName: user.name,
              classTitle: title,
              startsAt: startsAtFormatted,
              durationMin: num(formData, "duration_min") || 60,
              classesUrl: `${baseUrl}/subjects/${subjectId}/classes`,
            }),
          })
        )
      );
    }).catch((err) => console.error("[email] class notification error:", err));
  })();

  revalidatePath(`/subjects/${subjectId}/classes`);
}

export async function deleteClass(formData: FormData) {
  const user = await requireUser();
  const classId = num(formData, "class_id");
  const row = await q1<{ subject_id: number }>(
    "SELECT subject_id FROM classes WHERE id = $1",
    [classId]
  );
  if (!row) return;
  const access = await subjectAccess(row.subject_id, user.id, user.role);
  if (access?.as !== "teacher") return;
  await q("DELETE FROM classes WHERE id = $1", [classId]);
  revalidatePath(`/subjects/${row.subject_id}/classes`);
}

// ---------- Invitations ----------

export async function acceptInvitation(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "teacher") return;
  const invitationId = num(formData, "invitation_id");
  await q(
    "UPDATE subject_teachers SET status = 'active' WHERE id = $1 AND teacher_id = $2",
    [invitationId, user.id]
  );
  revalidatePath("/dashboard");
}

export async function declineInvitation(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "teacher") return;
  const invitationId = num(formData, "invitation_id");
  await q(
    "DELETE FROM subject_teachers WHERE id = $1 AND teacher_id = $2",
    [invitationId, user.id]
  );
  revalidatePath("/dashboard");
}
