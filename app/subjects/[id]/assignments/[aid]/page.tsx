import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q, q1 } from "@/lib/db";
import { fmtDateTime, fmtRelative, isPast } from "@/lib/format";
import { submitAssignment, gradeSubmission } from "@/lib/actions";

type Assignment = {
  id: number;
  title: string;
  instructions: string;
  due_at: Date;
  max_marks: number | null;
  late_policy: string;
};

type TrackerRow = {
  student_id: number;
  student_name: string;
  submission_id: number | null;
  text: string | null;
  file_name: string | null;
  is_late: boolean | null;
  score: number | null;
  feedback: string | null;
  submitted_at: Date | null;
};

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; aid: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id, aid } = await params;
  const { error } = await searchParams;
  const subjectId = Number(id);
  const assignmentId = Number(aid);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");

  const assignment = await q1<Assignment>(
    "SELECT * FROM assignments WHERE id = $1 AND subject_id = $2",
    [assignmentId, subjectId]
  );
  if (!assignment) redirect(`/subjects/${subjectId}/assignments`);
  const overdue = isPast(assignment!.due_at);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold">{assignment!.title}</h2>
        <p className={`mt-1 text-sm ${overdue ? "text-slate-500" : "text-red-600"}`}>
          Due {fmtDateTime(assignment!.due_at)} ({fmtRelative(assignment!.due_at)})
          {assignment!.max_marks != null && (
            <span className="ml-2 text-slate-500">· {assignment!.max_marks} marks</span>
          )}
          <span className="ml-2 text-slate-500">
            · Late submissions:{" "}
            {assignment!.late_policy === "block" ? "blocked" : "allowed (flagged)"}
          </span>
        </p>
        {assignment!.instructions && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
            {assignment!.instructions}
          </p>
        )}
      </div>

      {error === "late" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          The due date has passed and this assignment does not accept late submissions.
        </p>
      )}
      {error === "toobig" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          File is too large — the limit is 5 MB.
        </p>
      )}

      {access.as === "student" ? (
        <StudentView assignmentId={assignmentId} userId={user.id} overdue={overdue} blockLate={assignment!.late_policy === "block"} />
      ) : (
        <TeacherTracker subjectId={subjectId} assignmentId={assignmentId} maxMarks={assignment!.max_marks} />
      )}
    </div>
  );
}

async function StudentView({
  assignmentId,
  userId,
  overdue,
  blockLate,
}: {
  assignmentId: number;
  userId: number;
  overdue: boolean;
  blockLate: boolean;
}) {
  const submission = await q1<{
    id: number;
    text: string;
    file_name: string | null;
    is_late: boolean;
    score: number | null;
    feedback: string | null;
    submitted_at: Date;
  }>("SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2", [
    assignmentId,
    userId,
  ]);

  const canSubmit = !overdue || !blockLate;

  return (
    <div className="space-y-4">
      {submission && (
        <div className="card border-emerald-200 bg-emerald-50/50">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-emerald-800">
              ✓ Your submission
              {submission.is_late ? (
                <span className="badge ml-2 bg-amber-100 text-amber-700">Late</span>
              ) : null}
            </h3>
            <span className="text-xs text-slate-500">{fmtDateTime(submission.submitted_at)}</span>
          </div>
          {submission.text && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{submission.text}</p>
          )}
          {submission.file_name && (
            <p className="mt-2 text-sm">
              📎{" "}
              <a href={`/api/files/${submission.id}`} className="text-indigo-600 hover:underline">
                {submission.file_name}
              </a>
            </p>
          )}
          {(submission.score != null || submission.feedback) && (
            <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
              <h4 className="text-sm font-semibold text-indigo-700">Teacher feedback</h4>
              {submission.score != null && (
                <p className="mt-1 text-sm font-medium">Score: {submission.score}</p>
              )}
              {submission.feedback && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {submission.feedback}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {canSubmit ? (
        <form action={submitAssignment} className="card space-y-3">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <h3 className="font-semibold">{submission ? "Resubmit" : "Submit your work"}</h3>
          {overdue && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              The due date has passed — this will be flagged as a late submission.
            </p>
          )}
          <div>
            <label className="label" htmlFor="text">Answer (text)</label>
            <textarea className="input" id="text" name="text" rows={4} defaultValue={submission?.text ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="file">Attach a file (PDF/image/doc, max 5 MB)</label>
            <input className="input" id="file" name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt" />
          </div>
          <div className="flex justify-end">
            <button className="btn">{submission ? "Resubmit" : "Submit"}</button>
          </div>
        </form>
      ) : (
        !submission && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            The due date has passed and late submissions are blocked for this assignment.
          </p>
        )
      )}
    </div>
  );
}

async function TeacherTracker({
  subjectId,
  assignmentId,
  maxMarks,
}: {
  subjectId: number;
  assignmentId: number;
  maxMarks: number | null;
}) {
  const rows = await q<TrackerRow>(
    `SELECT u.id AS student_id, u.name AS student_name,
       s.id AS submission_id, s.text, s.file_name, s.is_late, s.score, s.feedback, s.submitted_at
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     LEFT JOIN submissions s ON s.assignment_id = $1 AND s.student_id = u.id
     WHERE e.subject_id = $2 AND e.status = 'active'
     ORDER BY u.name`,
    [assignmentId, subjectId]
  );

  const submitted = rows.filter((r) => r.submission_id != null).length;

  return (
    <div className="card p-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 className="font-semibold">Submission tracker</h3>
        <span className="badge bg-indigo-100 text-indigo-700">
          {submitted}/{rows.length} submitted
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-600">No students enrolled yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.student_id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.student_name}</span>
                {r.submission_id == null ? (
                  <span className="badge bg-slate-100 text-slate-600">Not submitted</span>
                ) : r.is_late ? (
                  <span className="badge bg-amber-100 text-amber-700">Late</span>
                ) : (
                  <span className="badge bg-emerald-100 text-emerald-700">Submitted</span>
                )}
              </div>
              {r.submission_id != null && (
                <div className="mt-2 text-sm text-slate-700">
                  <p className="text-xs text-slate-500">{fmtDateTime(r.submitted_at!)}</p>
                  {r.text && <p className="mt-1 whitespace-pre-wrap">{r.text}</p>}
                  {r.file_name && (
                    <p className="mt-1">
                      📎{" "}
                      <a
                        href={`/api/files/${r.submission_id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {r.file_name}
                      </a>
                    </p>
                  )}
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800">
                      {r.score != null || r.feedback
                        ? `Feedback given${r.score != null ? ` · ${r.score}${maxMarks != null ? `/${maxMarks}` : ""}` : ""} — edit`
                        : "Give feedback / score"}
                    </summary>
                    <form action={gradeSubmission} className="mt-2 space-y-2">
                      <input type="hidden" name="submission_id" value={r.submission_id} />
                      <div className="flex gap-2">
                        <input
                          className="input max-w-28"
                          name="score"
                          type="number"
                          step="0.5"
                          min={0}
                          max={maxMarks ?? undefined}
                          placeholder={maxMarks != null ? `/ ${maxMarks}` : "Score"}
                          defaultValue={r.score ?? ""}
                        />
                        <input
                          className="input"
                          name="feedback"
                          placeholder="Feedback for the student"
                          defaultValue={r.feedback ?? ""}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button className="btn">Save</button>
                      </div>
                    </form>
                  </details>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
