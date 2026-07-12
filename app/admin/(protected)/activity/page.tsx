import { q } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";

type ActivityRow = {
  kind: "signup" | "submission" | "thread" | "reply" | "class";
  ts: Date;
  description: string;
};

const ICONS: Record<ActivityRow["kind"], string> = {
  signup: "🆕",
  submission: "📝",
  thread: "💬",
  reply: "↩️",
  class: "🎥",
};

export default async function AdminActivity() {
  const rows = await q<ActivityRow>(`
    SELECT * FROM (
      SELECT 'signup' AS kind, u.created_at AS ts,
        u.name || ' signed up as ' || u.role AS description
      FROM users u

      UNION ALL

      SELECT 'submission', sub.submitted_at,
        us.name || ' submitted "' || a.title || '"'
      FROM submissions sub
      JOIN users us ON us.id = sub.student_id
      JOIN assignments a ON a.id = sub.assignment_id

      UNION ALL

      SELECT 'thread', th.created_at,
        ut.name || ' started a discussion: "' || th.title || '"'
      FROM threads th
      JOIN users ut ON ut.id = th.author_id

      UNION ALL

      SELECT 'reply', r.created_at,
        ur.name || ' replied in a discussion'
      FROM replies r
      JOIN users ur ON ur.id = r.author_id
      WHERE r.deleted = false

      UNION ALL

      SELECT 'class', c.created_at,
        uc.name || ' scheduled "' || c.title || '"'
      FROM classes c
      JOIN subjects sc ON sc.id = c.subject_id
      JOIN users uc ON uc.id = sc.teacher_id
    ) feed
    ORDER BY ts DESC
    LIMIT 50
  `);

  return (
    <div>
      <h2 className="mb-3 font-semibold">Recent activity across the platform</h2>
      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="mt-1 text-sm">Nothing has happened yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="text-lg">{ICONS[r.kind]}</span>
              <span className="flex-1 text-slate-700">{r.description}</span>
              <span className="whitespace-nowrap text-xs text-slate-400">{fmtDateTime(r.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
