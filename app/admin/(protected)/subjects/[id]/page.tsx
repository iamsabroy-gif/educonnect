import Link from "next/link";
import { redirect } from "next/navigation";
import { q, q1 } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { adminAddStudent, adminSetEnrollmentStatus, adminReassignTeacher } from "@/lib/admin-actions";
import { EmailAutocomplete } from "@/components/EmailAutocomplete";
import { SubmitButton } from "@/components/SubmitButton";

type SubjectRow = {
  id: number;
  name: string;
  category: string;
  join_code: string;
  archived: boolean;
  teacher_id: number;
  teacher_name: string;
};

type EnrollmentRow = {
  id: number;
  status: string;
  created_at: Date | string;
  name: string;
  email: string;
};

type TeacherOption = {
  id: number;
  name: string;
  email: string;
};

type StudentOption = {
  name: string;
  email: string;
};

export default async function AdminSubjectDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; reassigned?: string }>;
}) {
  const { id } = await params;
  const { error, reassigned } = await searchParams;
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId)) redirect("/admin/subjects");

  const subject = await q1<SubjectRow>(
    `SELECT s.id, s.name, s.category, s.join_code, s.archived, s.teacher_id, u.name AS teacher_name
     FROM subjects s JOIN users u ON u.id = s.teacher_id WHERE s.id = $1`,
    [subjectId]
  );
  if (!subject) redirect("/admin/subjects");

  const enrollments = await q<EnrollmentRow>(
    `SELECT e.id, e.status, e.created_at, u.name, u.email
     FROM enrollments e JOIN users u ON u.id = e.student_id
     WHERE e.subject_id = $1 ORDER BY e.status DESC, u.name`,
    [subjectId]
  );
  const teachers = await q<TeacherOption>(
    "SELECT id, name, email FROM users WHERE role = 'teacher' ORDER BY name"
  );
  const students = await q<StudentOption>(
    "SELECT name, email FROM users WHERE role = 'student' ORDER BY name"
  );

  const pending = enrollments.filter((e) => e.status === "pending");
  const active = enrollments.filter((e) => e.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/subjects" className="text-sm text-indigo-600 hover:underline">
          ← All subjects
        </Link>
        <h2 className="mt-1 text-xl font-bold">{subject.name}</h2>
        <p className="text-sm text-slate-500">
          {subject.category && `${subject.category} · `}Join code:{" "}
          <span className="font-mono font-semibold">{subject.join_code}</span>
        </p>
      </div>

      {error === "notfound" && (
        <p className="banner-error">
          No matching student account found — pick a suggestion from the dropdown or enter their exact email.
        </p>
      )}
      {error === "invalidteacher" && (
        <p className="banner-error">Please choose a valid teacher account.</p>
      )}
      {reassigned === "1" && (
        <p className="banner-success">
          ✓ Teacher updated — <strong>{subject.teacher_name}</strong> now teaches this class.
        </p>
      )}

      <div className="card">
        <h3 className="font-semibold">
          Teacher <span className="font-normal text-slate-500">(currently {subject.teacher_name})</span>
        </h3>
        <form action={adminReassignTeacher} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="subject_id" value={subjectId} />
          <select className="input max-w-xs" name="teacher_id" defaultValue={subject.teacher_id}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.email})
              </option>
            ))}
          </select>
          <SubmitButton pendingLabel="Reassigning…" className="btn">
            Reassign
          </SubmitButton>
        </form>
      </div>

      <form action={adminAddStudent} className="card space-y-2">
        <input type="hidden" name="subject_id" value={subjectId} />
        <label className="label">Add a student by name or email</label>
        <div className="flex gap-2">
          <EmailAutocomplete options={students} placeholder="Search students…" />
          <button className="btn whitespace-nowrap">Add student</button>
        </div>
      </form>

      {pending.length > 0 && (
        <section>
          <h3 className="font-semibold">Pending join requests ({pending.length})</h3>
          <div className="mt-2 space-y-2">
            {pending.map((e) => (
              <div key={e.id} className="card flex flex-wrap items-center justify-between gap-3 border-amber-200 py-3">
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-slate-500">
                    {e.email} · requested {fmtDateTime(e.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={adminSetEnrollmentStatus}>
                    <input type="hidden" name="subject_id" value={subjectId} />
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn">Approve</button>
                  </form>
                  <form action={adminSetEnrollmentStatus}>
                    <input type="hidden" name="subject_id" value={subjectId} />
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button className="btn-danger">Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Enrolled students ({active.length})</h3>
        {active.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No students enrolled yet.</p>
        ) : (
          <div className="card mt-2 p-0">
            <ul className="divide-y divide-slate-100">
              {active.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-slate-500">
                      {e.email} · joined {fmtDateTime(e.created_at)}
                    </p>
                  </div>
                  <form action={adminSetEnrollmentStatus}>
                    <input type="hidden" name="subject_id" value={subjectId} />
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="decision" value="remove" />
                    <button className="btn-danger">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
