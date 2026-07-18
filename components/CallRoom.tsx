"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Built-in video call: a full mesh of browser-to-browser WebRTC connections,
 * signaled through /api/call/[room] by polling. Mesh means every participant
 * uploads their stream to every other participant, so this is sized for
 * one-to-one and small-group classes (~4 people) — beyond that an SFU/media
 * server would be needed.
 *
 * Connection setup: both sides learn of each other from the polled peer list;
 * the peer with the lexicographically smaller peer id creates the offer, which
 * avoids offer/offer glare without needing perfect negotiation (tracks are
 * added before the offer, so no renegotiation ever happens).
 */

type RemotePeer = { peerId: string; name: string; stream: MediaStream | null };

// Poll fast while any connection is still being set up, slow once the mesh is
// settled — the slow tick is just a heartbeat + join watcher, and it keeps
// Neon's free-tier compute mostly idle during a long class.
const FAST_POLL_MS = 1200;
const SLOW_POLL_MS = 4000;

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  // Optional TURN relay for strict NATs (Jio/Airtel mobile data etc.) —
  // without one, peers behind carrier-grade NAT may fail to connect.
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((u) => u.trim()),
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }
  return servers;
}

export function CallRoom({
  roomCode,
  userId,
  selfName,
  classTitle,
  subjectName,
  subjectId,
}: {
  roomCode: string;
  userId: number;
  selfName: string;
  classTitle: string;
  subjectName: string;
  subjectId: number;
}) {
  const router = useRouter();
  const api = `/api/call/${encodeURIComponent(roomCode)}`;

  // Random suffix lets the same user join from two tabs/devices without the
  // two sessions fighting over one peer identity. The user-id prefix is what
  // the server checks against the session.
  const peerIdRef = useRef(`${userId}-${Math.random().toString(36).slice(2, 8)}`);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const sinceRef = useRef(0);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const [phase, setPhase] = useState<"lobby" | "call">("lobby");
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [remotes, setRemotes] = useState<RemotePeer[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const attachLocalPreview = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
      el.srcObject = localStreamRef.current;
    }
  }, []);

  // Camera/mic preview starts in the lobby so permission prompts and device
  // problems surface before joining; the same stream carries into the call.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setMediaError("");
        setMediaReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setMediaError(
            "Camera/microphone unavailable or blocked — you can still join to watch and listen."
          );
          setMediaReady(true);
        }
      });
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  const send = useCallback(
    (to: string, type: string, payload: unknown) => {
      fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: peerIdRef.current, to, type, payload }),
      }).catch(() => {});
    },
    [api]
  );

  const ensurePc = useCallback(
    (theirId: string) => {
      const existing = pcsRef.current.get(theirId);
      if (existing) return existing;
      const pc = new RTCPeerConnection({ iceServers: iceServers() });
      pcsRef.current.set(theirId, pc);
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      } else {
        // No local media (permission denied): still receive the other side.
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) send(theirId, "ice", e.candidate.toJSON());
      };
      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        if (!remoteStream) return;
        setRemotes((prev) =>
          prev.map((r) => (r.peerId === theirId ? { ...r, stream: remoteStream } : r))
        );
      };
      pc.onconnectionstatechange = () => {
        // Drop failed connections; the next poll re-initiates from scratch.
        if (pc.connectionState === "failed") {
          pc.close();
          if (pcsRef.current.get(theirId) === pc) pcsRef.current.delete(theirId);
          setRemotes((prev) =>
            prev.map((r) => (r.peerId === theirId ? { ...r, stream: null } : r))
          );
        }
      };
      return pc;
    },
    [send]
  );

  // The signaling loop, running only during the call phase.
  useEffect(() => {
    if (phase !== "call") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pcs = pcsRef.current;

    const reconcile = async (data: {
      peers: { peer_id: string; name: string }[];
      signals: { id: number; from_peer: string; type: string; payload: string }[];
    }) => {
      const peerList = data.peers ?? [];

      for (const [id, pc] of pcs) {
        if (!peerList.some((p) => p.peer_id === id)) {
          pc.close();
          pcs.delete(id);
        }
      }
      setRemotes((prev) =>
        peerList.map(
          (p) =>
            prev.find((r) => r.peerId === p.peer_id) ?? {
              peerId: p.peer_id,
              name: p.name,
              stream: null,
            }
        )
      );

      for (const p of peerList) {
        if (peerIdRef.current < p.peer_id && !pcs.has(p.peer_id)) {
          const pc = ensurePc(p.peer_id);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          send(p.peer_id, "offer", offer);
        }
      }

      for (const s of data.signals ?? []) {
        sinceRef.current = Math.max(sinceRef.current, s.id);
        let payload: unknown;
        try {
          payload = JSON.parse(s.payload);
        } catch {
          continue;
        }
        try {
          if (s.type === "offer") {
            const pc = ensurePc(s.from_peer);
            await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send(s.from_peer, "answer", answer);
          } else if (s.type === "answer") {
            const pc = pcs.get(s.from_peer);
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
            }
          } else if (s.type === "ice") {
            const pc = pcs.get(s.from_peer);
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(payload as RTCIceCandidateInit);
            }
          }
        } catch {
          // A stale/mismatched signal (peer refreshed mid-handshake) — the
          // failed-connection handler recovers by re-offering.
        }
      }
    };

    const poll = async () => {
      if (stopped) return;
      let settled = false;
      try {
        const res = await fetch(
          `${api}?peerId=${encodeURIComponent(peerIdRef.current)}&since=${sinceRef.current}`
        );
        if (res.ok) {
          const data = await res.json();
          await reconcile(data);
          settled =
            data.peers.length === pcs.size &&
            [...pcs.values()].every((pc) => pc.connectionState === "connected");
        }
      } catch {
        // Transient network error — keep polling.
      }
      if (!stopped) timer = setTimeout(poll, settled ? SLOW_POLL_MS : FAST_POLL_MS);
    };
    poll();

    const leaveBeacon = () => {
      navigator.sendBeacon?.(
        api,
        new Blob([JSON.stringify({ from: peerIdRef.current, action: "leave" })], {
          type: "application/json",
        })
      );
    };
    window.addEventListener("pagehide", leaveBeacon);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("pagehide", leaveBeacon);
      pcs.forEach((pc) => pc.close());
      pcs.clear();
      leaveBeacon();
    };
  }, [phase, api, ensurePc, send]);

  const toggleTrack = (kind: "audio" | "video", on: boolean) => {
    localStreamRef.current?.getTracks().forEach((t) => {
      if (t.kind === kind) t.enabled = on;
    });
  };

  const leave = () => {
    router.push(`/subjects/${subjectId}/classes`);
  };

  if (phase === "lobby") {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <div className="card space-y-3">
          <h2 className="font-semibold">{classTitle}</h2>
          <p className="text-sm text-slate-600">{subjectName}</p>
          <video
            ref={attachLocalPreview}
            autoPlay
            playsInline
            muted
            className="mx-auto aspect-video w-full rounded-xl bg-slate-900 object-cover [transform:scaleX(-1)]"
          />
          {mediaError && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{mediaError}</p>
          )}
          <button
            type="button"
            className="btn w-full justify-center disabled:opacity-50"
            disabled={!mediaReady}
            onClick={() => setPhase("call")}
          >
            {mediaReady ? "Join class" : "Preparing camera…"}
          </button>
          <p className="text-xs text-slate-500">
            Video runs directly between participants (WebRTC) — best for one-to-one and
            small-group sessions.
          </p>
        </div>
      </div>
    );
  }

  const tiles = 1 + remotes.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">{classTitle}</h2>
          <p className="text-sm text-slate-600">
            {subjectName} · {tiles} in call
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              toggleTrack("audio", !micOn);
              setMicOn(!micOn);
            }}
          >
            {micOn ? "🎙 Mute" : "🔇 Unmute"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              toggleTrack("video", !camOn);
              setCamOn(!camOn);
            }}
          >
            {camOn ? "📷 Camera off" : "📷 Camera on"}
          </button>
          <button type="button" className="btn bg-red-600 hover:bg-red-700" onClick={leave}>
            Leave
          </button>
        </div>
      </div>

      <div
        className={`grid gap-3 ${tiles <= 1 ? "grid-cols-1" : tiles <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        <div className="relative overflow-hidden rounded-xl bg-slate-900">
          <video
            ref={attachLocalPreview}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full object-cover [transform:scaleX(-1)]"
          />
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
            {selfName} (you){micOn ? "" : " · muted"}
          </span>
        </div>
        {remotes.map((r) => (
          <div key={r.peerId} className="relative overflow-hidden rounded-xl bg-slate-900">
            {r.stream ? (
              <video
                autoPlay
                playsInline
                className="aspect-video w-full object-cover"
                ref={(el) => {
                  if (el && r.stream && el.srcObject !== r.stream) el.srcObject = r.stream;
                }}
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center text-sm text-slate-400">
                Connecting…
              </div>
            )}
            <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              {r.name}
            </span>
          </div>
        ))}
      </div>

      {remotes.length === 0 && (
        <p className="text-center text-sm text-slate-500">
          Waiting for others to join — keep this tab open.
        </p>
      )}
    </div>
  );
}
