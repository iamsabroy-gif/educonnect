import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

type TeacherSubject = {
  id: number;
  name: string;
  category: string;
  schedule: string;
  join_code: string;
  archived: boolean;
  student_count: number;
  pending_requests: number;
  ungraded: number;
  next_class: Date | null;
};

type StudentSubject = {
  id: number;
  name: string;
  category: string;
  schedule: string;
  teacher_name: string;
  status: string;
  open_assignments: number;
  next_class: Date | null;
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string }>;
}) {
  const user = await requireUser();
  const { joined } = await searchParams;

  if (user.role === "teacher") {
    const subjects = await q<TeacherSubject>(
      `SELECT s.*,
         (SELECT COUNT(*)::int FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'active') AS student_count,
         (SELECT COUNT(*)::int FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'pending') AS pending_requests,
         (SELECT COUNT(*)::int FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
           WHERE a.subject_id = s.id AND sub.score IS NULL AND sub.feedback IS NULL) AS ungraded,
         (SELECT MIN(c.starts_at) FROM classes c WHERE c.subject_id = s.id AND c.starts_at > now()) AS next_class
       FROM subjects s WHERE s.teacher_id = $1 ORDER BY s.archived, s.created_at DESC`,
      [user.id]
    );

    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your subjects</h1>
          <Link href="/subjects/new" className="btn">
            + New subject
          </Link>
        </div>
        {subjects.length === 0 ? (
          <div className="card mt-6 text-center text-slate-600">
            <p className="text-3xl">🧑‍🏫</p>
            <p className="mt-2 font-medium">You don&apos;t teach any subjects yet.</p>
            <p className="mt-1 text-sm">
              Create your first subject and share its join code with students.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card hover:border-indigo-300">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  {s.archived ? (
                    <span className="badge bg-slate-100 text-slate-600">Archived</span>
                  ) : (
                    <span className="badge bg-indigo-100 text-indigo-700">
                      Code: {s.join_code}
                    </span>
                  )}
                </div>
                {s.category && <p className="mt-0.5 text-sm text-slate-500">{s.category}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>👥 {s.student_count} students</span>
                  {s.pending_requests > 0 && (
                    <span className="font-medium text-amber-600">
                      ⏳ {s.pending_requests} join request{s.pending_requests > 1 ? "s" : ""}
                    </span>
                  )}
                  {s.ungraded > 0 && (
                    <span className="font-medium text-indigo-600">
                      📝 {s.ungraded} to review
                    </span>
                  )}
                </div>
                {s.next_class && (
                  <p className="mt-2 text-sm text-slate-500">
                    🎥 Next class: {fmtDateTime(s.next_class)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Student dashboard
  const subjects = await q<StudentSubject>(
    `SELECT s.id, s.name, s.category, s.schedule, u.name AS teacher_name, e.status,
       (SELECT COUNT(*)::int FROM assignments a WHERE a.subject_id = s.id AND a.due_at > now()
         AND NOT EXISTS (SELECT 1 FROM submissions sub WHERE sub.assignment_id = a.id AND sub.student_id = e.student_id)) AS open_assignments,
       (SELECT MIN(c.starts_at) FROM classes c WHERE c.subject_id = s.id AND c.starts_at > now()) AS next_class
     FROM enrollments e
     JOIN subjects s ON s.id = e.subject_id
     JOIN users u ON u.id = s.teacher_id
     WHERE e.student_id = $1 AND s.archived = false
     ORDER BY e.created_at DESC`,
    [user.id]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your subjects</h1>
        <Link href="/join" className="btn">
          + Join a subject
        </Link>
      </div>
      {joined === "pending" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Join request sent — you&apos;ll get access once the teacher approves it.
        </p>
      )}
      {subjects.length === 0 ? (
        <div className="card mt-6 text-center text-slate-600">
          <p className="text-3xl">🎓</p>
          <p className="mt-2 font-medium">You&apos;re not enrolled in any subjects yet.</p>
          <p className="mt-1 text-sm">Ask your teacher for a join code to get started.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {subjects.map((s) =>
            s.status === "pending" ? (
              <div key={s.id} className="card opacity-70">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  <span className="badge bg-amber-100 text-amber-700">Awaiting approval</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{s.teacher_name}</p>
              </div>
            ) : (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card hover:border-indigo-300">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  {s.open_assignments > 0 && (
                    <span className="badge bg-red-100 text-red-700">
                      {s.open_assignments} due
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {s.teacher_name}
                  {s.category ? ` · ${s.category}` : ""}
                </p>
                {s.schedule && <p className="mt-2 text-sm text-slate-600">🗓 {s.schedule}</p>}
                {s.next_class && (
                  <p className="mt-1 text-sm text-slate-500">
                    🎥 Next class: {fmtDateTime(s.next_class)}
                  </p>
                )}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
