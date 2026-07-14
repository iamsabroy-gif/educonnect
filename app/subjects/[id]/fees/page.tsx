import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q1 } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { buildUpiUri, buildUpiQrDataUrl } from "@/lib/upi";
import { UpiPayActions } from "@/components/UpiPayActions";

export default async function FeesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "student") redirect(`/subjects/${subjectId}`);
  const { subject } = access;

  if (subject.fee_amount == null || !subject.fee_upi_id) {
    redirect(`/subjects/${subjectId}`);
  }

  const teacher = (await q1<{ name: string }>("SELECT name FROM users WHERE id = $1", [
    subject.teacher_id,
  ]))!;

  const enrollment = (await q1<{ fee_paid: boolean; fee_paid_at: Date | null }>(
    "SELECT fee_paid, fee_paid_at FROM enrollments WHERE subject_id = $1 AND student_id = $2",
    [subjectId, user.id]
  ))!;

  const upiUri = buildUpiUri({
    payeeUpiId: subject.fee_upi_id,
    payeeName: teacher.name,
    amount: subject.fee_amount,
    note: subject.fee_note || subject.name,
  });
  const qrDataUrl = await buildUpiQrDataUrl(upiUri);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card text-center">
        {enrollment.fee_paid ? (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            ✅ Marked as paid{enrollment.fee_paid_at ? ` on ${fmtDateTime(enrollment.fee_paid_at)}` : ""}
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Payment pending — your teacher will mark it paid once received.
          </div>
        )}

        <h3 className="mt-4 font-semibold">Pay ₹{subject.fee_amount.toFixed(2)} via UPI</h3>
        {subject.fee_note && <p className="mt-1 text-sm text-slate-600">{subject.fee_note}</p>}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="UPI payment QR code" className="mx-auto mt-4 h-56 w-56" />

        <p className="mt-3 text-xs text-slate-500">
          Scan with any UPI app, or copy the UPI ID and pay manually
        </p>
        <UpiPayActions
          upiId={subject.fee_upi_id}
          qrDataUrl={qrDataUrl}
          shareText={`Pay ₹${subject.fee_amount.toFixed(2)} for ${subject.name} to ${teacher.name} (${subject.fee_upi_id}) — scan this QR in your UPI app`}
        />

        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Paying: <span className="font-mono">{subject.fee_upi_id}</span> ({teacher.name})
        </div>
      </div>
    </div>
  );
}
