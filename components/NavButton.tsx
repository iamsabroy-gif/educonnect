"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function NavButton({
  href,
  children,
  className = "btn",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      className={className}
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.push(href);
        });
      }}
    >
      {isPending && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}
