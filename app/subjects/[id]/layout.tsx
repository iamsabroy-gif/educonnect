import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q, q1 } from "@/lib/db";
import { leaveSubject } from "@/lib/actions";
import TabNav from "@/components/TabNav";
import { SubmitButton } from "@/components/SubmitButton";


export default async function SubjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");
  const { subject, as } = access;

  const teacher = (await q1<{ name: string }>("SELECT name FROM users WHERE id = $1", [
    subject.teacher_id,
  ]))!;
  const coTeachers = await q<{ name: string }>(
    `SELECT u.name FROM subject_teachers st
     JOIN users u ON u.id = st.teacher_id
     WHERE st.subject_id = $1 AND st.status = 'active'`,
    [subjectId]
  );
  const teacherNames = [teacher.name, ...coTeachers.map((ct) => ct.name)].join(", ");
  const studentCount = (
    await q1<{ c: number }>(
      "SELECT CAST(COUNT(*) AS INTEGER) AS c FROM enrollments WHERE subject_id = $1 AND status = 'active'",
      [subjectId]
    )
  )!.c;
  const pendingRequests =
    as === "teacher"
      ? (
          await q1<{ c: number }>(
            "SELECT CAST(COUNT(*) AS INTEGER) AS c FROM enrollments WHERE subject_id = $1 AND status = 'pending'",
            [subjectId]
          )
        )!.c
      : 0;

  const base = `/subjects/${subjectId}`;
  const tabs = [
    { href: base, label: "📢 Announcements", exact: true },
    { href: `${base}/assignments`, label: "📝 Assignments" },
    { href: `${base}/discussions`, label: "💬 Discussions" },
    { href: `${base}/classes`, label: "🎥 Classes" },
    ...(as === "student" && subject.fee_amount != null && subject.fee_upi_id
      ? [{ href: `${base}/fees`, label: "💰 Fees" }]
      : []),
    ...(as === "teacher"
      ? [
          { href: `${base}/students`, label: "👥 Students", badge: pendingRequests },
          { href: `${base}/settings`, label: "⚙️ Settings" },
        ]
      : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{subject.name}</h1>
            {subject.archived ? (
              <span className="badge bg-slate-200 text-slate-600">Archived</span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {teacherNames}
            {subject.category ? ` · ${subject.category}` : ""} · 👥 {studentCount} students
            {subject.schedule ? ` · 🗓 ${subject.schedule}` : ""}
          </p>
          {subject.description && (
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{subject.description}</p>
          )}
        </div>
        {as === "teacher" ? (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">
            <span className="text-slate-600">Join code: </span>
            <span className="font-mono text-base font-bold tracking-widest text-indigo-700">
              {subject.join_code}
            </span>
          </div>
        ) : (
          <form action={leaveSubject}>
            <input type="hidden" name="subject_id" value={subjectId} />
            <SubmitButton className="btn-danger" pendingLabel="Leaving…">Leave subject</SubmitButton>
          </form>
        )}
      </div>
      <div className="mt-6">
        <TabNav tabs={tabs} />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
