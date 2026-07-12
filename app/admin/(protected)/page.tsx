import { q1 } from "@/lib/db";

type Totals = {
  teachers: number;
  students: number;
  subjects_active: number;
  subjects_archived: number;
  submissions: number;
  threads: number;
  replies: number;
  classes: number;
  signups_7d: number;
  signups_30d: number;
};

export default async function AdminOverview() {
  const t = await q1<Totals>(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE role = 'teacher') AS teachers,
      (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students,
      (SELECT COUNT(*)::int FROM subjects WHERE archived = false) AS subjects_active,
      (SELECT COUNT(*)::int FROM subjects WHERE archived = true) AS subjects_archived,
      (SELECT COUNT(*)::int FROM submissions) AS submissions,
      (SELECT COUNT(*)::int FROM threads) AS threads,
      (SELECT COUNT(*)::int FROM replies WHERE deleted = false) AS replies,
      (SELECT COUNT(*)::int FROM classes) AS classes,
      (SELECT COUNT(*)::int FROM users WHERE created_at > now() - interval '7 days') AS signups_7d,
      (SELECT COUNT(*)::int FROM users WHERE created_at > now() - interval '30 days') AS signups_30d
  `);

  const cards: [string, number, string][] = [
    ["👩‍🏫", t!.teachers, "Teachers"],
    ["🎓", t!.students, "Students"],
    ["📚", t!.subjects_active, "Active subjects"],
    ["🗄", t!.subjects_archived, "Archived subjects"],
    ["📝", t!.submissions, "Submissions"],
    ["💬", t!.threads, "Discussion threads"],
    ["↩️", t!.replies, "Replies"],
    ["🎥", t!.classes, "Classes scheduled"],
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([icon, value, label]) => (
          <div key={label} className="card">
            <div className="text-2xl">{icon}</div>
            <div className="mt-2 text-2xl font-bold">{value}</div>
            <div className="text-sm text-slate-500">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Signups, last 7 days</h2>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{t!.signups_7d}</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Signups, last 30 days</h2>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{t!.signups_30d}</p>
        </div>
      </div>
    </div>
  );
}
