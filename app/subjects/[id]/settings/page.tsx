import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { updateSubject } from "@/lib/actions";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") redirect(`/subjects/${subjectId}`);
  const s = access.subject;

  return (
    <div className="mx-auto max-w-lg">
      <form action={updateSubject} className="card space-y-4">
        <input type="hidden" name="subject_id" value={subjectId} />
        <div>
          <label className="label" htmlFor="name">Subject name *</label>
          <input className="input" id="name" name="name" defaultValue={s.name} required />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea className="input" id="description" name="description" rows={3} defaultValue={s.description} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category / grade</label>
            <input className="input" id="category" name="category" defaultValue={s.category} />
          </div>
          <div>
            <label className="label" htmlFor="schedule">Weekly schedule</label>
            <input className="input" id="schedule" name="schedule" defaultValue={s.schedule} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="approval_required"
            defaultChecked={!!s.approval_required}
            className="h-4 w-4 rounded"
          />
          Require my approval before students can join
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="allow_student_threads"
            defaultChecked={!!s.allow_student_threads}
            className="h-4 w-4 rounded"
          />
          Allow students to start discussion threads
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="archived" defaultChecked={!!s.archived} className="h-4 w-4 rounded" />
          Archive this subject (hides it from students&apos; dashboards, blocks new joins)
        </label>
        <button className="btn w-full justify-center">Save settings</button>
      </form>
    </div>
  );
}
