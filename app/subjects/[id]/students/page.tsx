import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { setEnrollmentStatus, addStudentByEmail, regenerateJoinCode, setFeePaid } from "@/lib/actions";

type EnrollmentRow = {
  id: number;
  status: string;
  created_at: Date;
  name: string;
  email: string;
  fee_paid: boolean;
  fee_paid_at: Date | null;
};

export default async function StudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") redirect(`/subjects/${subjectId}`);

  const enrollments = await q<EnrollmentRow>(
    `SELECT e.id, e.status, e.created_at, e.fee_paid, e.fee_paid_at, u.name, u.email
     FROM enrollments e JOIN users u ON u.id = e.student_id
     WHERE e.subject_id = $1 ORDER BY e.status DESC, u.name`,
    [subjectId]
  );
  const feesConfigured = access.subject.fee_amount != null && !!access.subject.fee_upi_id;

  const pending = enrollments.filter((e) => e.status === "pending");
  const active = enrollments.filter((e) => e.status === "active");

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Invite students</h3>
          <p className="mt-1 text-sm text-slate-600">
            Share this join code:{" "}
            <span className="font-mono text-base font-bold tracking-widest text-indigo-700">
              {access.subject.join_code}
            </span>
          </p>
        </div>
        <form action={regenerateJoinCode}>
          <input type="hidden" name="subject_id" value={subjectId} />
          <button className="btn-secondary" title="Invalidates the old code">
            ↻ Regenerate code
          </button>
        </form>
      </div>

      <form action={addStudentByEmail} className="card space-y-2">
        <label className="label" htmlFor="email">Add a student by email</label>
        {error === "notfound" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            No student account found with that email. Ask them to sign up first.
          </p>
        )}
        <div className="flex gap-2">
          <input type="hidden" name="subject_id" value={subjectId} />
          <input className="input" id="email" name="email" type="email" placeholder="student@example.com" required />
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
                  <form action={setEnrollmentStatus}>
                    <input type="hidden" name="enrollment_id" value={e.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button className="btn">Approve</button>
                  </form>
                  <form action={setEnrollmentStatus}>
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
          <p className="mt-2 text-sm text-slate-600">
            No students yet — share the join code above.
          </p>
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
                  <div className="flex items-center gap-2">
                    {feesConfigured && (
                      <form action={setFeePaid}>
                        <input type="hidden" name="enrollment_id" value={e.id} />
                        <input type="hidden" name="paid" value={e.fee_paid ? "0" : "1"} />
                        <button
                          className={e.fee_paid ? "btn-secondary" : "btn"}
                          title={e.fee_paid_at ? `Paid ${fmtDateTime(e.fee_paid_at)}` : undefined}
                        >
                          {e.fee_paid ? "✅ Fee paid" : "💰 Mark fee paid"}
                        </button>
                      </form>
                    )}
                    <form action={setEnrollmentStatus}>
                      <input type="hidden" name="enrollment_id" value={e.id} />
                      <input type="hidden" name="decision" value="remove" />
                      <button className="btn-danger">Remove</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
