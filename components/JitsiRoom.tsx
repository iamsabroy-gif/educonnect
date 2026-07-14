"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type JitsiApi = {
  dispose: () => void;
  addListener: (event: string, listener: () => void) => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

const SCRIPT_SRC = "https://meet.jit.si/external_api.js";

function loadJitsiScript(): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Failed to load Jitsi API")));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * Embeds the Jitsi meeting via the IFrame API so that ending the call lands
 * back in the app (backHref) instead of stranding the user on Jitsi's static
 * close page (meet.jit.si/static/close3.html).
 */
export function JitsiRoom({
  roomCode,
  displayName,
  backHref,
}: {
  roomCode: string;
  displayName: string;
  backHref: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let api: JitsiApi | undefined;
    let cancelled = false;
    loadJitsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        containerRef.current.innerHTML = "";
        api = new window.JitsiMeetExternalAPI("meet.jit.si", {
          roomName: roomCode,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: { disableDeepLinking: true },
        });
        // Fires when the conference is over (hang up, kicked, meeting ended).
        api.addListener("readyToClose", () => router.replace(backHref));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      api?.dispose();
    };
  }, [roomCode, displayName, backHref, router]);

  if (failed) {
    return (
      <div className="card text-center text-sm text-slate-600">
        <p>Couldn&apos;t load the embedded video call (network/ad-blocker?).</p>
        <a
          href={`https://meet.jit.si/${roomCode}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn mt-3 inline-flex justify-center"
        >
          Open in Jitsi Meet instead
        </a>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-13rem)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-900"
    />
  );
}
