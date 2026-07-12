"use client";

import { useTransition } from "react";
import { createSubject } from "@/lib/actions";
import { EmailAutocomplete } from "@/components/EmailAutocomplete";

type Teacher = { name: string; email: string };

export function CreateSubjectForm({ teachers }: { teachers: Teacher[] }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createSubject(formData);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="name">Subject name *</label>
        <input className="input" id="name" name="name" placeholder="e.g. Physics — Class XII" required />
      </div>
      <div>
        <label className="label" htmlFor="description">Description</label>
        <textarea className="input" id="description" name="description" rows={3} placeholder="What will students learn?" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="category">Category / grade</label>
          <input className="input" id="category" name="category" placeholder="e.g. Grade 12" />
        </div>
        <div>
          <label className="label" htmlFor="schedule">Weekly schedule</label>
          <input className="input" id="schedule" name="schedule" placeholder="e.g. Tue & Thu, 6–7 PM" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="approval_required" className="h-4 w-4 rounded" />
        Require my approval before students can join
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="allow_student_threads" defaultChecked className="h-4 w-4 rounded" />
        Allow students to start discussion threads
      </label>
      <div>
        <label className="label" htmlFor="co_teacher">Additional teacher (optional)</label>
        <EmailAutocomplete options={teachers} fieldName="co_teacher" placeholder="Search teacher by name or email…" required={false} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="btn w-full justify-center"
      >
        {isPending && <span className="spinner" aria-hidden />}
        {isPending ? "Creating…" : "Create subject"}
      </button>
    </form>
  );
}
