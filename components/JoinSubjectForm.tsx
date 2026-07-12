"use client";

import { useTransition } from "react";
import { joinSubject } from "@/lib/actions";

export function JoinSubjectForm({
  error,
  code,
}: {
  error?: string;
  code?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await joinSubject(formData);
    });
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold">Join a subject</h1>
      <p className="mt-1 text-sm text-slate-600">
        Enter the 6-character code your teacher shared with you.
      </p>
      {error === "notfound" && (
        <p className="banner-error">No subject found with that code. Double-check and try again.</p>
      )}
      {error === "pending" && (
        <p className="banner-info">You already have a pending request for this subject.</p>
      )}
      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="code">Join code</label>
          <input
            className="input text-center font-mono text-lg uppercase tracking-[0.3em]"
            id="code"
            name="code"
            defaultValue={code ?? ""}
            maxLength={6}
            placeholder="ABC123"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn w-full justify-center"
        >
          {isPending && <span className="spinner" aria-hidden />}
          {isPending ? "Joining…" : "Join"}
        </button>
      </form>
    </div>
  );
}
