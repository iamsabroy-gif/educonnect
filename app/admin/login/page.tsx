import { adminLogin } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordField } from "@/components/PasswordField";


export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">
        <span className="badge mr-2 bg-slate-900 text-white">Admin</span>
        Sign in
      </h1>
      <p className="mt-1 text-sm text-slate-600">Restricted to platform administrators.</p>
      {error && <p className="banner-error">Invalid username or password.</p>}
      <form action={adminLogin} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="username">Username</label>
          <input className="input" id="username" name="username" autoComplete="username" required />
        </div>
        <PasswordField autoComplete="current-password" />
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>
    </div>
  );
}
