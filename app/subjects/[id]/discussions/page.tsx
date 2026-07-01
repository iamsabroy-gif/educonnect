import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q } from "@/lib/db";
import { fmtRelative } from "@/lib/format";
import { createThread } from "@/lib/actions";

type ThreadRow = {
  id: number;
  title: string;
  pinned: boolean;
  locked: boolean;
  created_at: Date;
  author_name: string;
  author_role: string;
  reply_count: number;
  last_activity: Date;
};

export default async function DiscussionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { q: qParam } = await searchParams;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");

  const search = (qParam ?? "").trim();
  const threads = await q<ThreadRow>(
    `SELECT t.id, t.title, t.pinned, t.locked, t.created_at,
       u.name AS author_name, u.role AS author_role,
       (SELECT COUNT(*)::int FROM replies r WHERE r.thread_id = t.id AND r.deleted = false) AS reply_count,
       COALESCE ((SELECT MAX(r.created_at) FROM replies r WHERE r.thread_id = t.id), t.created_at) AS last_activity
     FROM threads t JOIN users u ON u.id = t.author_id
     WHERE t.subject_id = $1
       AND ($2 = '' OR t.title ILIKE '%' || $2 || '%' OR t.body ILIKE '%' || $2 || '%'
            OR EXISTS (SELECT 1 FROM replies r WHERE r.thread_id = t.id AND r.deleted = false AND r.body ILIKE '%' || $2 || '%'))
     ORDER BY t.pinned DESC, last_activity DESC`,
    [subjectId, search]
  );

  const canCreate = access.as === "teacher" || !!access.subject.allow_student_threads;

  return (
    <div className="space-y-4">
      <form method="GET" className="flex gap-2">
        <input
          className="input"
          name="q"
          placeholder="Search discussions…"
          defaultValue={search}
        />
        <button className="btn-secondary">Search</button>
      </form>

      {canCreate && (
        <details className="card">
          <summary className="cursor-pointer font-medium text-indigo-700">
            + Start a new discussion
          </summary>
          <form action={createThread} className="mt-3 space-y-3">
            <input type="hidden" name="subject_id" value={subjectId} />
            <input className="input" name="title" placeholder="Topic title" required />
            <textarea
              className="input"
              name="body"
              rows={3}
              placeholder="Describe your question or topic…"
            />
            <div className="flex justify-end">
              <button className="btn">Post thread</button>
            </div>
          </form>
        </details>
      )}
      {!canCreate && (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Only the teacher can start new threads in this subject. You can reply within existing
          threads.
        </p>
      )}

      {threads.length === 0 ? (
        <div className="card text-center text-slate-600">
          <p className="text-3xl">💬</p>
          <p className="mt-2 text-sm">
            {search ? `No threads matching “${search}”.` : "No discussions yet."}
          </p>
        </div>
      ) : (
        threads.map((t) => (
          <Link
            key={t.id}
            href={`/subjects/${subjectId}/discussions/${t.id}`}
            className="card block hover:border-indigo-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">
                {t.pinned ? "📌 " : ""}
                {t.title}
                {t.locked ? (
                  <span className="badge ml-2 bg-slate-100 text-slate-600">🔒 Locked</span>
                ) : null}
              </h3>
              <span className="badge bg-slate-100 text-slate-600">
                {t.reply_count} repl{t.reply_count === 1 ? "y" : "ies"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Started by {t.author_name}
              {t.author_role === "teacher" ? " (teacher)" : ""} · last activity{" "}
              {fmtRelative(t.last_activity)}
            </p>
          </Link>
        ))
      )}
    </div>
  );
}
