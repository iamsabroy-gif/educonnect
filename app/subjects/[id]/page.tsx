import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q, q1 } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAck,
} from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";


type Announcement = {
  id: number;
  body: string;
  created_at: Date;
  edited_at: Date | null;
  ack_count: number;
  viewer_acked: boolean;
};

export default async function AnnouncementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");

  const announcements = await q<Announcement>(
    `SELECT a.*,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM announcement_acks k WHERE k.announcement_id = a.id) AS ack_count,
       EXISTS (SELECT 1 FROM announcement_acks k WHERE k.announcement_id = a.id AND k.user_id = $1) AS viewer_acked
     FROM announcements a WHERE a.subject_id = $2 ORDER BY a.created_at DESC`,
    [user.id, subjectId]
  );

  const studentCount = (
    await q1<{ c: number }>(
      "SELECT CAST(COUNT(*) AS INTEGER) AS c FROM enrollments WHERE subject_id = $1 AND status = 'active'",
      [subjectId]
    )
  )!.c;

  return (
    <div className="space-y-4">
      {access.as === "teacher" && (
        <form action={createAnnouncement} className="card space-y-3">
          <input type="hidden" name="subject_id" value={subjectId} />
          <label className="label" htmlFor="body">New announcement</label>
          <textarea
            className="input"
            id="body"
            name="body"
            rows={3}
            placeholder="Share an update with all enrolled students…"
            required
          />
          <div className="flex justify-end">
            <SubmitButton className="btn" pendingLabel="Posting…">Post announcement</SubmitButton>
          </div>
        </form>
      )}

      {announcements.length === 0 ? (
        <div className="card text-center text-slate-600">
          <p className="text-3xl">📢</p>
          <p className="mt-2 text-sm">No announcements yet.</p>
        </div>
      ) : (
        announcements.map((a) => (
          <div key={a.id} className="card">
            <p className="whitespace-pre-wrap text-sm text-slate-800">{a.body}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>
                {fmtDateTime(a.created_at)}
                {a.edited_at && <em className="ml-1.5 text-slate-400">(edited)</em>}
              </span>
              <div className="flex items-center gap-2">
                {access.as === "student" ? (
                  <form action={toggleAck}>
                    <input type="hidden" name="announcement_id" value={a.id} />
                    <SubmitButton
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                        a.viewer_acked
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      👍 {a.viewer_acked ? "Acknowledged" : "Acknowledge"}
                      {a.ack_count > 0 ? ` · ${a.ack_count}` : ""}
                    </SubmitButton>
                  </form>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    👍 {a.ack_count}/{studentCount} acknowledged
                  </span>
                )}
              </div>
            </div>
            {access.as === "teacher" && (
              <details className="mt-3 border-t border-slate-100 pt-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                  Edit / delete
                </summary>
                <form action={updateAnnouncement} className="mt-2 space-y-2">
                  <input type="hidden" name="announcement_id" value={a.id} />
                  <textarea className="input" name="body" rows={3} defaultValue={a.body} required />
                  <div className="flex items-center justify-end gap-2">
                    <SubmitButton className="btn" pendingLabel="Saving…">Save changes</SubmitButton>
                  </div>
                </form>
                <form action={deleteAnnouncement} className="mt-2 flex justify-end">
                  <input type="hidden" name="announcement_id" value={a.id} />
                  <SubmitButton className="btn-danger" pendingLabel="Deleting…">Delete announcement</SubmitButton>
                </form>
              </details>
            )}
          </div>
        ))
      )}
    </div>
  );
}
