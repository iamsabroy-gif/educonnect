"use client";

import { useTransition, useState } from "react";
import { updateSubject, deleteSubject } from "@/lib/actions";

type SubjectData = {
  id: number;
  name: string;
  description: string;
  category: string;
  schedule: string;
  approval_required: boolean | number;
  allow_student_threads: boolean | number;
  archived: boolean | number;
  fee_amount: number | null;
  fee_upi_id: string;
  fee_note: string;
};

export function SettingsForm({
  subject,
  error,
}: {
  subject: SubjectData;
  error?: string;
}) {
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSave(async () => {
      await updateSubject(formData);
    });
  }

  function handleDelete() {
    const formData = new FormData();
    formData.set("subject_id", String(subject.id));
    setShowConfirm(false);
    startDelete(async () => {
      await deleteSubject(formData);
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="card space-y-4">
        {error === "upi" && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            That doesn&apos;t look like a valid UPI ID (e.g. name@okhdfcbank).
          </p>
        )}
        <input type="hidden" name="subject_id" value={subject.id} />
        <div>
          <label className="label" htmlFor="name">Subject name *</label>
          <input className="input" id="name" name="name" defaultValue={subject.name} required />
        </div>
        <div>
          <label className="label" htmlFor="description">Description</label>
          <textarea className="input" id="description" name="description" rows={3} defaultValue={subject.description} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="category">Category / grade</label>
            <input className="input" id="category" name="category" defaultValue={subject.category} />
          </div>
          <div>
            <label className="label" htmlFor="schedule">Weekly schedule</label>
            <input className="input" id="schedule" name="schedule" defaultValue={subject.schedule} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="approval_required"
            defaultChecked={!!subject.approval_required}
            className="h-4 w-4 rounded"
          />
          Require my approval before students can join
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="allow_student_threads"
            defaultChecked={!!subject.allow_student_threads}
            className="h-4 w-4 rounded"
          />
          Allow students to start discussion threads
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="archived" defaultChecked={!!subject.archived} className="h-4 w-4 rounded" />
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
                defaultValue={subject.fee_amount ?? ""}
                placeholder="e.g. 1500"
              />
            </div>
            <div>
              <label className="label" htmlFor="fee_upi_id">Your UPI ID</label>
              <input
                className="input"
                id="fee_upi_id"
                name="fee_upi_id"
                defaultValue={subject.fee_upi_id}
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
              defaultValue={subject.fee_note}
              placeholder="e.g. Monthly tuition fee — July"
            />
          </div>
        </div>

        <button type="submit" disabled={isSaving} className="btn w-full justify-center">
          {isSaving && <span className="spinner" aria-hidden />}
          {isSaving ? "Saving…" : "Save settings"}
        </button>
      </form>

      {/* ── Danger Zone ── */}
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50/40 p-5">
        <h3 className="font-semibold text-red-800">⚠️ Danger Zone</h3>
        <p className="mt-1 text-sm text-red-700">
          Permanently delete this subject and all its data — enrollments, assignments,
          classes, discussions, and submissions. This action <strong>cannot be undone</strong>.
        </p>
        <button
          type="button"
          disabled={isDeleting}
          onClick={() => setShowConfirm(true)}
          className="btn-danger mt-4 inline-flex items-center gap-2"
        >
          {isDeleting && <span className="spinner" aria-hidden />}
          {isDeleting ? "Deleting…" : "Delete subject"}
        </button>
      </div>

      {/* ── Confirmation modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">Delete &ldquo;{subject.name}&rdquo;?</h2>
            <p className="mt-2 text-sm text-slate-600">
              All students, assignments, classes, and discussions in this subject will be
              permanently deleted. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger"
              >
                Yes, delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
