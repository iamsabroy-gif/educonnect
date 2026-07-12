"use client";

import { useTransition } from "react";
import { logout } from "@/lib/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await logout();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="btn-secondary"
    >
      {isPending && <span className="spinner" aria-hidden />}
      {isPending ? "Logging out…" : "Log out"}
    </button>
  );
}
