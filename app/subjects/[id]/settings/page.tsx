import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { SettingsForm } from "@/components/SettingsForm";

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (access?.as !== "teacher") redirect(`/subjects/${subjectId}`);
  const s = access.subject;

  return (
    <div className="mx-auto max-w-lg">
      <SettingsForm subject={s} error={error} />
    </div>
  );
}
