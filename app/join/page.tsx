import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { JoinSubjectForm } from "@/components/JoinSubjectForm";

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const user = await requireUser();
  if (user.role !== "student") redirect("/dashboard");
  const { error, code } = await searchParams;

  return <JoinSubjectForm error={error} code={code} />;
}
