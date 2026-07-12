import Link from "next/link";
import { q } from "@/lib/db";

type SubjectRow = {
  id: number;
  name: string;
  category: string;
  join_code: string;
  archived: boolean;
  teacher_name: string;
  student_count: number;
};

export default async function AdminSubjects() {
  const subjects = await q<SubjectRow>(`
    SELECT s.id, s.name, s.category, s.join_code, s.archived, u.name AS teacher_name,
      (SELECT CAST(COUNT(*) AS INTEGER) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'active') AS student_count
    FROM subjects s JOIN users u ON u.id = s.teacher_id
    ORDER BY s.archived, s.created_at DESC
  `);

  return (
    <div>
      <h2 className="mb-3 font-semibold">All subjects ({subjects.length})</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Subject</th>
              <th className="px-4 py-2 font-medium">Teacher</th>
              <th className="px-4 py-2 font-medium">Students</th>
              <th className="px-4 py-2 font-medium">Join code</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{s.name}</div>
                  {s.category && <div className="text-xs text-slate-500">{s.category}</div>}
                </td>
                <td className="px-4 py-2 text-slate-600">{s.teacher_name}</td>
                <td className="px-4 py-2 text-slate-600">{s.student_count}</td>
                <td className="px-4 py-2">
                  <span className="badge bg-indigo-100 text-indigo-700">{s.join_code}</span>
                </td>
                <td className="px-4 py-2">
                  {s.archived ? (
                    <span className="badge bg-slate-100 text-slate-600">Archived</span>
                  ) : (
                    <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/admin/subjects/${s.id}`} className="btn-ghost">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subjects.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">No subjects yet.</p>
        )}
      </div>
    </div>
  );
}
