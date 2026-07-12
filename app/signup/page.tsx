import Link from "next/link";
import { signup } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordField } from "@/components/PasswordField";


export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">
        Already have one?{" "}
        <Link href="/login" className="text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
      {error === "exists" && (
        <p className="banner-error">An account with that email already exists.</p>
      )}
      {error === "invalid" && (
        <p className="banner-error">
          Please fill all fields. Password must be at least 8 characters.
        </p>
      )}
      <form action={signup} className="card mt-6 space-y-4">
        <div>
          <label className="label">I am a…</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium has-checked:border-indigo-600 has-checked:bg-indigo-50 has-checked:text-indigo-700">
              <input type="radio" name="role" value="teacher" className="sr-only" required />
              🧑‍🏫 Teacher
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium has-checked:border-indigo-600 has-checked:bg-indigo-50 has-checked:text-indigo-700">
              <input type="radio" name="role" value="student" className="sr-only" />
              🎓 Student
            </label>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <PasswordField label="Password (min. 8 characters)" minLength={8} />
        <SubmitButton pendingLabel="Creating account…">Sign up</SubmitButton>
      </form>
    </div>
  );
}
