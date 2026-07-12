import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSubject } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { q } from "@/lib/db";
import { EmailAutocomplete } from "@/components/EmailAutocomplete";



export default async function NewSubjectPage() {
  const user = await requireUser();
  if (user.role !== "teacher") redirect("/dashboard");

  const teachers = await q<{ name: string; email: string }>(
    "SELECT name, email FROM users WHERE role = 'teacher' AND id != $1",
    [user.id]
  );

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Create a subject</h1>
      <p className="mt-1 text-sm text-slate-600">
        You&apos;ll get a unique join code to share with your students.
      </p>
      <form action={createSubject} className="card mt-6 space-y-4">
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
        <SubmitButton className="btn w-full justify-center" pendingLabel="Creating…">Create subject</SubmitButton>
      </form>
    </div>
  );
}
