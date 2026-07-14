import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q1 } from "@/lib/db";
import { JitsiRoom } from "@/components/JitsiRoom";

export default async function LiveClassPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const user = await requireUser();
  const { code } = await params;

  const cls = await q1<{ id: number; title: string; subject_id: number; subject_name: string }>(
    `SELECT c.id, c.title, c.subject_id, s.name AS subject_name
     FROM classes c JOIN subjects s ON s.id = c.subject_id
     WHERE c.room_code = $1`,
    [code]
  );
  if (!cls) redirect("/dashboard");

  const access = await getSubjectAccess(cls.subject_id, user.id, user.role);
  if (!access) redirect("/dashboard");

  const backHref = `/subjects/${cls.subject_id}/classes`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">🎥 {cls.title}</h1>
          <p className="text-sm text-slate-600">{cls.subject_name}</p>
        </div>
        <Link href={backHref} className="btn-secondary">
          ← Back to classes
        </Link>
      </div>
      <JitsiRoom roomCode={code} displayName={user.name} backHref={backHref} />
    </div>
  );
}
