"use client";

import { useState, useEffect } from "react";
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
  const [clicked, setClicked] = useState(false);
  const isPending = pending || clicked;

  useEffect(() => {
    if (!pending) {
      setClicked(false);
    }
  }, [pending]);

  return (
    <button
      className={className}
      type="submit"
      disabled={isPending}
      title={title}
      onClick={(e) => {
        const form = e.currentTarget.form;
        if (form && form.checkValidity()) {
          setTimeout(() => setClicked(true), 0);
        }
      }}
    >
      {isPending && <span className="spinner" aria-hidden />}
      {isPending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
