import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { updateSubject } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";


export default async function SettingsPage({
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
  const s = access.subject;

  return (
    <div className="mx-auto max-w-lg">
      <form action={updateSubject} className="card space-y-4">
        {error === "upi" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            That doesn&apos;t look like a valid UPI ID (e.g. name@okhdfcbank).
          </p>
        )}
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

        <div className="border-t border-slate-100 pt-4">
          <h3 className="font-semibold">💰 Fees via UPI</h3>
          <p className="mt-1 text-xs text-slate-500">
            Set an amount and your UPI ID to show students a pay-by-UPI QR code and link on the
            Fees tab. Payments happen directly in the student&apos;s UPI app — you mark them as
            paid yourself from the Students tab.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fee_amount">Fee amount (₹)</label>
              <input
                className="input"
                id="fee_amount"
                name="fee_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={s.fee_amount ?? ""}
                placeholder="e.g. 1500"
              />
            </div>
            <div>
              <label className="label" htmlFor="fee_upi_id">Your UPI ID</label>
              <input
                className="input"
                id="fee_upi_id"
                name="fee_upi_id"
                defaultValue={s.fee_upi_id}
                placeholder="yourname@okhdfcbank"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="fee_note">Note shown with payment (optional)</label>
            <input
              className="input"
              id="fee_note"
              name="fee_note"
              defaultValue={s.fee_note}
              placeholder="e.g. Monthly tuition fee — July"
            />
          </div>
        </div>

        <SubmitButton className="btn w-full justify-center" pendingLabel="Saving…">Save settings</SubmitButton>
      </form>
    </div>
  );
}
