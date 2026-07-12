import Link from "next/link";
import { login } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="text-indigo-600 hover:underline">
          Create an account
        </Link>
      </p>
      {error && <p className="banner-error">Invalid email or password.</p>}
      <form action={login} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required />
        </div>
        <SubmitButton pendingLabel="Signing in…">Log in</SubmitButton>
      </form>
    </div>
  );
}
