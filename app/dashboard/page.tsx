import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { q } from "@/lib/db";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { acceptInvitation, declineInvitation } from "@/lib/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { NavButton } from "@/components/NavButton";
import { JoinClassButton } from "@/components/JoinClassButton";



type TeacherSubject = {
  id: number;
  name: string;
  category: string;
  schedule: string;
  join_code: string;
  archived: boolean;
  student_count: number;
  pending_requests: number;
  ungraded: number;
  next_class: Date | null;
};

type StudentSubject = {
  id: number;
  name: string;
  category: string;
  schedule: string;
  teacher_name: string;
  status: string;
  open_assignments: number;
  next_class: Date | null;
};

type UpcomingClassAlert = {
  id: number;
  title: string;
  starts_at: string;
  room_code: string | null;
  subject_name: string;
  subject_id: number;
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ joined?: string; welcome?: string }>;
}) {
  const user = await requireUser();
  const { joined, welcome } = await searchParams;

  const welcomeBanner = welcome === "1" && (
    <p className="banner-success">
      🎉 Welcome{user.name ? `, ${user.name}` : ""}! You&apos;re signed in as a {user.role}.
    </p>
  );

  const nowIso = new Date().toISOString();

  if (user.role === "teacher") {
    const tenMinsAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const tenMinsAheadIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const upcomingAlerts = await q<UpcomingClassAlert>(
      `SELECT c.id, c.title, c.starts_at, c.room_code, s.name AS subject_name, s.id AS subject_id
       FROM classes c
       JOIN subjects s ON s.id = c.subject_id
       WHERE (
         s.teacher_id = $1
         OR EXISTS (
           SELECT 1 FROM subject_teachers st
           WHERE st.subject_id = s.id AND st.teacher_id = $1 AND st.status = 'active'
         )
       )
       AND c.starts_at >= $2
       AND c.starts_at <= $3
       ORDER BY c.starts_at ASC`,
      [user.id, tenMinsAgoIso, tenMinsAheadIso]
    );

    const subjects = await q<TeacherSubject>(
      `SELECT s.*,
         (SELECT CAST(COUNT(*) AS INTEGER) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'active') AS student_count,
         (SELECT CAST(COUNT(*) AS INTEGER) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'pending') AS pending_requests,
         (SELECT CAST(COUNT(*) AS INTEGER) FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
           WHERE a.subject_id = s.id AND sub.score IS NULL AND sub.feedback IS NULL) AS ungraded,
         (SELECT MIN(c.starts_at) FROM classes c WHERE c.subject_id = s.id AND c.starts_at > $2) AS next_class
       FROM subjects s
       WHERE s.teacher_id = $1
          OR EXISTS (
               SELECT 1 FROM subject_teachers st
               WHERE st.subject_id = s.id AND st.teacher_id = $1 AND st.status = 'active'
             )
       ORDER BY s.archived, s.created_at DESC`,
      [user.id, nowIso]
    );

    const invitations = await q<{ id: number; subject_id: number; subject_name: string; inviter_name: string; class_title: string | null }>(
      `SELECT st.id, st.subject_id, s.name AS subject_name, u.name AS inviter_name, c.title AS class_title
       FROM subject_teachers st
       JOIN subjects s ON s.id = st.subject_id
       JOIN users u ON u.id = s.teacher_id
       LEFT JOIN classes c ON c.id = st.class_id
       WHERE st.teacher_id = $1 AND st.status = 'pending'`,
      [user.id]
    );

    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Your subjects</h1>
          <NavButton href="/subjects/new" className="btn">
            + New subject
          </NavButton>
        </div>
        {welcomeBanner}
        {upcomingAlerts.length > 0 && (
          <div className="mt-6 space-y-3">
            {upcomingAlerts.map((cls) => (
              <div key={cls.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm backdrop-blur-sm animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="text-2xl animate-bounce">⏰</span>
                  <div>
                    <h4 className="font-bold text-red-900 text-sm">Class starting soon: {cls.title}</h4>
                    <p className="text-xs text-red-700 font-medium">
                      Subject: {cls.subject_name} · Starts {fmtRelative(cls.starts_at)}
                    </p>
                  </div>
                </div>
                {cls.room_code && (
                  <JoinClassButton
                    roomCode={cls.room_code}
                    label="Join Jitsi Meet"
                    className="btn bg-red-600 hover:bg-red-700 py-1.5 px-4 text-xs font-semibold text-white whitespace-nowrap"
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {invitations.length > 0 && (
          <div className="mt-6 border-b border-slate-200 pb-6">
            <h2 className="text-lg font-semibold text-slate-800">🔔 Invitations</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {invitations.map((inv) => (
                <div key={inv.id} className="card border-indigo-200 bg-indigo-50/50">
                  <h3 className="font-semibold text-slate-900">
                    {inv.class_title ? `Co-host Class: ${inv.class_title}` : `Co-teach Subject`}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    <strong>{inv.inviter_name}</strong> invited you to join the class/subject{" "}
                    <strong>{inv.subject_name}</strong>.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <form action={acceptInvitation}>
                      <input type="hidden" name="invitation_id" value={inv.id} />
                      <SubmitButton className="btn py-1 px-3 whitespace-nowrap justify-center w-auto text-xs" pendingLabel="Accepting…">Accept</SubmitButton>
                    </form>
                    <form action={declineInvitation}>
                      <input type="hidden" name="invitation_id" value={inv.id} />
                      <SubmitButton className="btn-danger py-1 px-3 whitespace-nowrap justify-center w-auto text-xs" pendingLabel="Declining…">Decline</SubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {subjects.length === 0 ? (
          <div className="empty-state">
            <p className="text-3xl">🧑‍🏫</p>
            <p className="mt-2 font-medium">You don&apos;t teach any subjects yet.</p>
            <p className="mt-1 text-sm">
              Create your first subject and share its join code with students.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {subjects.map((s) => (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card card-hover">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  {s.archived ? (
                    <span className="badge bg-slate-100 text-slate-600">Archived</span>
                  ) : (
                    <span className="badge bg-indigo-100 text-indigo-700">
                      Code: {s.join_code}
                    </span>
                  )}
                </div>
                {s.category && <p className="mt-0.5 text-sm text-slate-500">{s.category}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span>👥 {s.student_count} students</span>
                  {s.pending_requests > 0 && (
                    <span className="font-medium text-amber-600">
                      ⏳ {s.pending_requests} join request{s.pending_requests > 1 ? "s" : ""}
                    </span>
                  )}
                  {s.ungraded > 0 && (
                    <span className="font-medium text-indigo-600">
                      📝 {s.ungraded} to review
                    </span>
                  )}
                </div>
                {s.next_class && (
                  <p className="mt-2 text-sm text-slate-500">
                    🎥 Next class: {fmtDateTime(s.next_class)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Student dashboard
  const tenMinsAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const tenMinsAheadIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const upcomingAlerts = await q<UpcomingClassAlert>(
    `SELECT c.id, c.title, c.starts_at, c.room_code, s.name AS subject_name, s.id AS subject_id
     FROM classes c
     JOIN subjects s ON s.id = c.subject_id
     JOIN enrollments e ON e.subject_id = s.id
     WHERE e.student_id = $1
     AND e.status = 'active'
     AND c.starts_at >= $2
     AND c.starts_at <= $3
     ORDER BY c.starts_at ASC`,
    [user.id, tenMinsAgoIso, tenMinsAheadIso]
  );

  const subjects = await q<StudentSubject>(
    `SELECT s.id, s.name, s.category, s.schedule, u.name AS teacher_name, e.status,
       (SELECT CAST(COUNT(*) AS INTEGER) FROM assignments a WHERE a.subject_id = s.id AND a.due_at > $2
         AND NOT EXISTS (SELECT 1 FROM submissions sub WHERE sub.assignment_id = a.id AND sub.student_id = e.student_id)) AS open_assignments,
       (SELECT MIN(c.starts_at) FROM classes c WHERE c.subject_id = s.id AND c.starts_at > $2) AS next_class
     FROM enrollments e
     JOIN subjects s ON s.id = e.subject_id
     JOIN users u ON u.id = s.teacher_id
     WHERE e.student_id = $1 AND s.archived = false
     ORDER BY e.created_at DESC`,
    [user.id, nowIso]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your subjects</h1>
        <Link href="/join" className="btn">
          + Join a subject
        </Link>
      </div>
      {welcomeBanner}
      {upcomingAlerts.length > 0 && (
        <div className="mt-6 space-y-3">
          {upcomingAlerts.map((cls) => (
            <div key={cls.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm backdrop-blur-sm animate-pulse">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-bounce">⏰</span>
                <div>
                  <h4 className="font-bold text-red-900 text-sm">Class starting soon: {cls.title}</h4>
                  <p className="text-xs text-red-700 font-medium">
                    Subject: {cls.subject_name} · Starts {fmtRelative(cls.starts_at)}
                  </p>
                </div>
              </div>
              {cls.room_code && (
                <JoinClassButton
                  roomCode={cls.room_code}
                  label="Join Jitsi Meet"
                  className="btn bg-red-600 hover:bg-red-700 py-1.5 px-4 text-xs font-semibold text-white whitespace-nowrap"
                />
              )}
            </div>
          ))}
        </div>
      )}
      {joined === "pending" && (
        <p className="banner-info">
          Join request sent — you&apos;ll get access once the teacher approves it.
        </p>
      )}
      {subjects.length === 0 ? (
        <div className="empty-state">
          <p className="text-3xl">🎓</p>
          <p className="mt-2 font-medium">You&apos;re not enrolled in any subjects yet.</p>
          <p className="mt-1 text-sm">Ask your teacher for a join code to get started.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {subjects.map((s) =>
            s.status === "pending" ? (
              <div key={s.id} className="card opacity-70">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  <span className="badge bg-amber-100 text-amber-700">Awaiting approval</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{s.teacher_name}</p>
              </div>
            ) : (
              <Link key={s.id} href={`/subjects/${s.id}`} className="card card-hover">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{s.name}</h2>
                  {s.open_assignments > 0 && (
                    <span className="badge bg-red-100 text-red-700">
                      {s.open_assignments} due
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {s.teacher_name}
                  {s.category ? ` · ${s.category}` : ""}
                </p>
                {s.schedule && <p className="mt-2 text-sm text-slate-600">🗓 {s.schedule}</p>}
                {s.next_class && (
                  <p className="mt-1 text-sm text-slate-500">
                    🎥 Next class: {fmtDateTime(s.next_class)}
                  </p>
                )}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
