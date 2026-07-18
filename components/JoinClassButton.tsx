import Link from "next/link";

/**
 * Entry point to a class's built-in video room (/call/[room]). Plain
 * navigation: the call page lives inside the app, so Back returns here and
 * Leave returns to the subject's classes page — no external tab to track.
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
  return (
    <Link href={`/call/${roomCode}`} className={className}>
      {label}
    </Link>
  );
}
