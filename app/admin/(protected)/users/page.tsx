import { q } from "@/lib/db";
import { fmtDateTime, fmtRelative } from "@/lib/format";

type UserRow = {
  id: number;
  name: string;
  email: string;
  role: "teacher" | "student";
  created_at: Date;
  last_login_at: Date | null;
  subjects_taught: number;
  subjects_enrolled: number;
  submissions_count: number;
  posts_count: number;
};

const INACTIVE_DAYS = 30;

function isInactive(u: UserRow): boolean {
  if (!u.last_login_at) return true;
  const ageMs = Date.now() - new Date(u.last_login_at).getTime();
  return ageMs > INACTIVE_DAYS * 24 * 60 * 60 * 1000;
}

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { q: search, role } = await searchParams;
  const roleFilter = role === "teacher" || role === "student" ? role : null;

  const rows = await q<UserRow>(
    `SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login_at,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM subjects s WHERE s.teacher_id = u.id) AS subjects_taught,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM enrollments e WHERE e.student_id = u.id AND e.status = 'active') AS subjects_enrolled,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM submissions sub WHERE sub.student_id = u.id) AS submissions_count,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM threads th WHERE th.author_id = u.id) +
       (SELECT CAST(COUNT(*) AS INTEGER) FROM replies r WHERE r.author_id = u.id AND r.deleted = false) AS posts_count
     FROM users u
     WHERE (CAST($1 AS TEXT) IS NULL OR LOWER(u.name) LIKE LOWER('%' || $1 || '%') OR LOWER(u.email) LIKE LOWER('%' || $1 || '%'))
       AND (CAST($2 AS TEXT) IS NULL OR u.role = $2)
     ORDER BY u.created_at DESC`,
    [search || null, roleFilter]
  );

  return (
    <div>
      <form className="card flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="label" htmlFor="q">Search</label>
          <input
            className="input"
            id="q"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Name or email…"
          />
        </div>
        <div>
          <label className="label" htmlFor="role">Role</label>
          <select className="input" id="role" name="role" defaultValue={role ?? ""}>
            <option value="">All</option>
            <option value="teacher">Teachers</option>
            <option value="student">Students</option>
          </select>
        </div>
        <button className="btn">Filter</button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Last login</th>
              <th className="px-4 py-2 font-medium">Activity</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`badge ${
                      u.role === "teacher"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">{fmtDateTime(u.created_at)}</td>
                <td className="px-4 py-2 text-slate-600">
                  {u.last_login_at ? fmtRelative(u.last_login_at) : "never"}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {u.role === "teacher"
                    ? `${u.subjects_taught} subject${u.subjects_taught === 1 ? "" : "s"} · ${u.posts_count} posts`
                    : `${u.subjects_enrolled} enrolled · ${u.submissions_count} submissions · ${u.posts_count} posts`}
                </td>
                <td className="px-4 py-2">
                  {isInactive(u) ? (
                    <span className="badge bg-amber-100 text-amber-700">
                      ⚠ inactive {INACTIVE_DAYS}+ days
                    </span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">active</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">No users match this filter.</p>
        )}
      </div>
    </div>
  );
}
