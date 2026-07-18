import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRoomAccess } from "@/lib/access";
import { q } from "@/lib/db";

/**
 * WebRTC signaling over the app database. Peers in a class's video room
 * exchange offers/answers/ICE candidates by writing rows the other side
 * polls for — no WebSocket server needed, which keeps the app deployable
 * unchanged on Render's free tier with either DB backend.
 */

// A peer that hasn't polled for this long is treated as gone.
const PEER_STALE_MS = 20_000;
// Signals only matter during call setup; expire them aggressively.
const SIGNAL_TTL_MS = 5 * 60_000;
const MAX_PAYLOAD_CHARS = 100_000;
const SIGNAL_TYPES = new Set(["offer", "answer", "ice"]);

async function authorize(room: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const roomAccess = await getRoomAccess(room, user.id, user.role);
  if (!roomAccess) return null;
  return user;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;
  const user = await authorize(room);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const peerId = req.nextUrl.searchParams.get("peerId") ?? "";
  const since = Number(req.nextUrl.searchParams.get("since")) || 0;
  // Peer IDs are self-assigned but must be prefixed with the caller's user id,
  // so one user can't read or spoof another user's signals.
  if (!peerId.startsWith(`${user.id}-`) || peerId.length > 40) {
    return NextResponse.json({ error: "bad peer id" }, { status: 400 });
  }

  const now = Date.now();
  await q(
    `INSERT INTO call_peers (room_code, peer_id, user_id, name, last_seen)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (room_code, peer_id) DO UPDATE SET last_seen = excluded.last_seen`,
    [room, peerId, user.id, user.name, new Date(now).toISOString()]
  );
  await q("DELETE FROM call_peers WHERE room_code = $1 AND last_seen < $2", [
    room,
    new Date(now - PEER_STALE_MS).toISOString(),
  ]);
  await q("DELETE FROM call_signals WHERE room_code = $1 AND created_at < $2", [
    room,
    new Date(now - SIGNAL_TTL_MS).toISOString(),
  ]);

  const peers = await q<{ peer_id: string; name: string }>(
    "SELECT peer_id, name FROM call_peers WHERE room_code = $1 AND peer_id <> $2 ORDER BY peer_id",
    [room, peerId]
  );
  const signals = await q<{ id: number; from_peer: string; type: string; payload: string }>(
    `SELECT id, from_peer, type, payload FROM call_signals
     WHERE room_code = $1 AND to_peer = $2 AND id > $3 ORDER BY id`,
    [room, peerId, since]
  );
  return NextResponse.json({ peers, signals });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ room: string }> }
) {
  const { room } = await params;
  const user = await authorize(room);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // sendBeacon posts as a Blob without a JSON content type — parse manually.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }

  const from = String(body.from ?? "");
  if (!from.startsWith(`${user.id}-`) || from.length > 40) {
    return NextResponse.json({ error: "bad peer id" }, { status: 400 });
  }

  if (body.action === "leave") {
    await q("DELETE FROM call_peers WHERE room_code = $1 AND peer_id = $2", [room, from]);
    await q(
      "DELETE FROM call_signals WHERE room_code = $1 AND (from_peer = $2 OR to_peer = $2)",
      [room, from]
    );
    return NextResponse.json({ ok: true });
  }

  const to = String(body.to ?? "");
  const type = String(body.type ?? "");
  const payload = JSON.stringify(body.payload ?? null);
  if (!to || to.length > 40 || !SIGNAL_TYPES.has(type) || payload.length > MAX_PAYLOAD_CHARS) {
    return NextResponse.json({ error: "bad signal" }, { status: 400 });
  }
  await q(
    `INSERT INTO call_signals (room_code, from_peer, to_peer, type, payload, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [room, from, to, type, payload, new Date().toISOString()]
  );
  return NextResponse.json({ ok: true });
}
