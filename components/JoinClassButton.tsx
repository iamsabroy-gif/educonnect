"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Opens the Jitsi room in a tab the app keeps a handle to (window.open, not a
 * plain link), so we can tell when the call tab is gone and can close it from
 * here — including once Jitsi lands on its static close page after hangup.
 * meet.jit.si cuts embedded (iframed) meetings off after ~5 minutes, so a
 * separate tab is the only free-tier option; this keeps the round trip short.
 */
export function JoinClassButton({
  roomCode,
  label,
  className = "btn",
}: {
  roomCode: string;
  label: string;
  className?: string;
}) {
  const winRef = useRef<Window | null>(null);
  const [inCall, setInCall] = useState(false);

  useEffect(() => {
    if (!inCall) return;
    const timer = setInterval(() => {
      if (!winRef.current || winRef.current.closed) {
        winRef.current = null;
        setInCall(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [inCall]);

  const join = () => {
    const url = `https://meet.jit.si/${roomCode}`;
    // Named target: clicking Join again focuses the existing call tab
    // instead of opening a duplicate room.
    const win = window.open(url, `jitsi-${roomCode}`);
    if (!win) {
      // Popup blocked — fall back to same-tab navigation; the app stays in
      // this tab's history so Back returns here.
      window.location.href = url;
      return;
    }
    winRef.current = win;
    setInCall(true);
    win.focus();
  };

  if (inCall) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <button type="button" className={className} onClick={() => winRef.current?.focus()}>
          ● Back to call
        </button>
        <button
          type="button"
          className="btn-secondary whitespace-nowrap"
          onClick={() => winRef.current?.close()}
        >
          Close call tab
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={className} onClick={join}>
      {label}
    </button>
  );
}
