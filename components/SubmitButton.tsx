"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  className = "btn w-full justify-center",
  title,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} title={title}>
      {pending && <span className="spinner" aria-hidden />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
