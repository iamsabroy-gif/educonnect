import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { createAssignment } from "@/lib/actions";
import { toLocalInputValue } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";


export default async function NewAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") redirect(`/subjects/${subjectId}`);

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 7);
  defaultDue.setHours(23, 59, 0, 0);

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-xl font-bold">New assignment</h2>
      <form action={createAssignment} className="card mt-4 space-y-4">
        <input type="hidden" name="subject_id" value={subjectId} />
        <div>
          <label className="label" htmlFor="title">Title *</label>
          <input className="input" id="title" name="title" required />
        </div>
        <div>
          <label className="label" htmlFor="instructions">Instructions</label>
          <textarea className="input" id="instructions" name="instructions" rows={4} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="due_at">Due date & time *</label>
            <input
              className="input"
              id="due_at"
              name="due_at"
              type="datetime-local"
              defaultValue={toLocalInputValue(defaultDue)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="max_marks">Max marks (optional)</label>
            <input className="input" id="max_marks" name="max_marks" type="number" min={1} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="late_policy">Late submissions</label>
          <select className="input" id="late_policy" name="late_policy" defaultValue="allow_late">
            <option value="allow_late">Allow, flagged as late</option>
            <option value="block">Block after due date</option>
          </select>
        </div>
        <SubmitButton className="btn w-full justify-center" pendingLabel="Publishing…">Publish assignment</SubmitButton>
      </form>
    </div>
  );
}
