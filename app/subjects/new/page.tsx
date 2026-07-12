import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { CreateSubjectForm } from "@/components/CreateSubjectForm";

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
      <CreateSubjectForm teachers={teachers} />
    </div>
  );
}
