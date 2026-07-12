import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q, q1 } from "@/lib/db";
import { fmtRelative } from "@/lib/format";
import { replyToThread, toggleVote, moderateThread, deleteReply } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";


type Thread = {
  id: number;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  created_at: Date;
  author_name: string;
  author_role: string;
};

type Reply = {
  id: number;
  parent_id: number | null;
  body: string;
  deleted: boolean;
  created_at: Date;
  author_id: number;
  author_name: string;
  author_role: string;
  votes: number;
  viewer_voted: boolean;
};

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string; tid: string }>;
}) {
  const user = await requireUser();
  const { id, tid } = await params;
  const subjectId = Number(id);
  const threadId = Number(tid);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");

  const thread = await q1<Thread>(
    `SELECT t.*, u.name AS author_name, u.role AS author_role
     FROM threads t JOIN users u ON u.id = t.author_id
     WHERE t.id = $1 AND t.subject_id = $2`,
    [threadId, subjectId]
  );
  if (!thread) redirect(`/subjects/${subjectId}/discussions`);

  const replies = await q<Reply>(
    `SELECT r.*, u.name AS author_name, u.role AS author_role,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM reply_votes v WHERE v.reply_id = r.id) AS votes,
       EXISTS (SELECT 1 FROM reply_votes v WHERE v.reply_id = r.id AND v.user_id = $1) AS viewer_voted
     FROM replies r JOIN users u ON u.id = r.author_id
     WHERE r.thread_id = $2
     ORDER BY r.created_at`,
    [user.id, threadId]
  );

  const topLevel = replies.filter((r) => r.parent_id == null);
  const childrenOf = (parentId: number) => replies.filter((r) => r.parent_id === parentId);
  const canReply = !thread!.locked || access.as === "teacher";

  return (
    <div className="space-y-4">
      <Link
        href={`/subjects/${subjectId}/discussions`}
        className="text-sm text-indigo-600 hover:underline"
      >
        ← All discussions
      </Link>

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-bold">
            {thread!.pinned ? "📌 " : ""}
            {thread!.title}
            {thread!.locked ? (
              <span className="badge ml-2 bg-slate-100 text-slate-600">🔒 Locked</span>
            ) : null}
          </h2>
          {access.as === "teacher" && (
            <div className="flex gap-1.5">
              {(["pin", "lock", "delete"] as const).map((m) => (
                <form key={m} action={moderateThread}>
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input type="hidden" name="moderation" value={m} />
                  <SubmitButton className={m === "delete" ? "btn-danger" : "btn-secondary"}>
                    {m === "pin"
                      ? thread!.pinned
                        ? "Unpin"
                        : "Pin"
                      : m === "lock"
                        ? thread!.locked
                          ? "Unlock"
                          : "Lock"
                        : "Delete"}
                  </SubmitButton>
                </form>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {thread!.author_name}
          {thread!.author_role === "teacher" ? " (teacher)" : ""} · {fmtRelative(thread!.created_at)}
        </p>
        {thread!.body && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">{thread!.body}</p>
        )}
      </div>

      <div className="space-y-3">
        {topLevel.map((r) => (
          <div key={r.id} className="card">
            <ReplyBlock reply={r} viewer={user} isTeacher={access.as === "teacher"} />
            {childrenOf(r.id).map((child) => (
              <div key={child.id} className="mt-3 border-l-2 border-slate-200 pl-4">
                <ReplyBlock reply={child} viewer={user} isTeacher={access.as === "teacher"} />
              </div>
            ))}
            {canReply && !r.deleted && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-indigo-600">
                  Reply
                </summary>
                <form action={replyToThread} className="mt-2 flex gap-2">
                  <input type="hidden" name="thread_id" value={threadId} />
                  <input type="hidden" name="parent_id" value={r.id} />
                  <input className="input" name="body" placeholder="Write a reply…" required />
                  <SubmitButton className="btn" pendingLabel="Posting…">Post</SubmitButton>
                </form>
              </details>
            )}
          </div>
        ))}
      </div>

      {canReply ? (
        <form action={replyToThread} className="card space-y-3">
          <input type="hidden" name="thread_id" value={threadId} />
          <label className="label" htmlFor="body">Add to the discussion</label>
          <textarea className="input" id="body" name="body" rows={3} required />
          <div className="flex justify-end">
            <SubmitButton className="btn" pendingLabel="Posting…">Post reply</SubmitButton>
          </div>
        </form>
      ) : (
        <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          🔒 This thread is locked by the teacher — no new replies.
        </p>
      )}
    </div>
  );
}

function ReplyBlock({
  reply,
  viewer,
  isTeacher,
}: {
  reply: Reply;
  viewer: { id: number };
  isTeacher: boolean;
}) {
  if (reply.deleted) {
    return <p className="text-sm italic text-slate-400">This reply was deleted.</p>;
  }
  return (
    <div>
      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-800">{reply.author_name}</span>
        {reply.author_role === "teacher" && (
          <span className="badge ml-1.5 bg-indigo-100 text-indigo-700">teacher</span>
        )}
        <span className="ml-1.5">· {fmtRelative(reply.created_at)}</span>
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{reply.body}</p>
      <div className="mt-2 flex items-center gap-2">
        <form action={toggleVote}>
          <input type="hidden" name="reply_id" value={reply.id} />
          <SubmitButton
            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              reply.viewer_voted
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            ▲ {reply.votes}
          </SubmitButton>
        </form>
        {(isTeacher || reply.author_id === viewer.id) && (
          <form action={deleteReply}>
            <input type="hidden" name="reply_id" value={reply.id} />
            <SubmitButton className="text-xs text-red-500 hover:underline" pendingLabel="Deleting…">Delete</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
