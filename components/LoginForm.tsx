"use client";

import { useTransition } from "react";
import Link from "next/link";
import { login } from "@/lib/actions";
import { PasswordField } from "@/components/PasswordField";

export function LoginForm({ error }: { error?: string }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await login(formData);
    });
  }

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
      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <PasswordField />
        <button
          type="submit"
          disabled={isPending}
          className="btn w-full justify-center"
        >
          {isPending && <span className="spinner" aria-hidden />}
          {isPending ? "Signing in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
