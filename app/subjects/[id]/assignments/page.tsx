import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q, q1 } from "@/lib/db";
import { fmtDateTime, fmtRelative, isPast } from "@/lib/format";

type AssignmentRow = {
  id: number;
  title: string;
  due_at: Date;
  max_marks: number | null;
  submitted_count: number;
  viewer_submitted: boolean;
  viewer_late: boolean;
};

export default async function AssignmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");

  const assignments = await q<AssignmentRow>(
    `SELECT a.id, a.title, a.due_at, a.max_marks,
       (SELECT COUNT(*)::int FROM submissions s WHERE s.assignment_id = a.id) AS submitted_count,
       EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = $1) AS viewer_submitted,
       COALESCE ((SELECT s.is_late FROM submissions s WHERE s.assignment_id = a.id AND s.student_id = $1), false) AS viewer_late
     FROM assignments a WHERE a.subject_id = $2 ORDER BY a.due_at DESC`,
    [user.id, subjectId]
  );

  const studentCount = (
    await q1<{ c: number }>(
      "SELECT COUNT(*)::int AS c FROM enrollments WHERE subject_id = $1 AND status = 'active'",
      [subjectId]
    )
  )!.c;

  return (
    <div className="space-y-4">
      {access.as === "teacher" && (
        <div className="flex justify-end">
          <Link href={`/subjects/${subjectId}/assignments/new`} className="btn">
            + New assignment
          </Link>
        </div>
      )}
      {assignments.length === 0 ? (
        <div className="card text-center text-slate-600">
          <p className="text-3xl">📝</p>
          <p className="mt-2 text-sm">No assignments yet.</p>
        </div>
      ) : (
        assignments.map((a) => {
          const overdue = isPast(a.due_at);
          return (
            <Link
              key={a.id}
              href={`/subjects/${subjectId}/assignments/${a.id}`}
              className="card block hover:border-indigo-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{a.title}</h3>
                  <p className={`mt-1 text-sm ${overdue ? "text-slate-500" : "text-red-600"}`}>
                    Due {fmtDateTime(a.due_at)} ({fmtRelative(a.due_at)})
                    {a.max_marks != null && (
                      <span className="ml-2 text-slate-500">· {a.max_marks} marks</span>
                    )}
                  </p>
                </div>
                {access.as === "teacher" ? (
                  <span className="badge bg-indigo-100 text-indigo-700">
                    {a.submitted_count}/{studentCount} submitted
                  </span>
                ) : a.viewer_submitted ? (
                  a.viewer_late ? (
                    <span className="badge bg-amber-100 text-amber-700">Submitted late</span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">Submitted</span>
                  )
                ) : overdue ? (
                  <span className="badge bg-red-100 text-red-700">Missed</span>
                ) : (
                  <span className="badge bg-amber-100 text-amber-700">To do</span>
                )}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
