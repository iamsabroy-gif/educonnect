import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRoomAccess } from "@/lib/access";
import { CallRoom } from "@/components/CallRoom";

export default async function CallPage({
  params,
}: {
  params: Promise<{ room: string }>;
}) {
  const user = await requireUser();
  const { room } = await params;
  const roomAccess = await getRoomAccess(room, user.id, user.role);
  // Unknown room or not enrolled/teaching — same access rule as the old
  // Jitsi links: the room is visible only to the subject's members.
  if (!roomAccess) redirect("/dashboard");
  const { cls, access } = roomAccess;

  return (
    <CallRoom
      roomCode={room}
      userId={user.id}
      selfName={user.name}
      classTitle={cls.title}
      subjectName={access.subject.name}
      subjectId={access.subject.id}
    />
  );
}
