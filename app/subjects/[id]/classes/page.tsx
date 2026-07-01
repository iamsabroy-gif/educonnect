import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSubjectAccess } from "@/lib/access";
import { q } from "@/lib/db";
import { fmtDateTime, fmtRelative, toDate } from "@/lib/format";
import { scheduleClass, deleteClass } from "@/lib/actions";

type ClassRow = {
  id: number;
  title: string;
  starts_at: Date;
  duration_min: number;
  room_code: string | null;
};

export default async function ClassesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const subjectId = Number(id);
  const access = await getSubjectAccess(subjectId, user.id, user.role);
  if (!access) redirect("/dashboard");

  const classes = await q<ClassRow>(
    "SELECT * FROM classes WHERE subject_id = $1 ORDER BY starts_at DESC",
    [subjectId]
  );

  const now = Date.now();
  const upcoming = classes
    .filter((c) => toDate(c.starts_at).getTime() + c.duration_min * 60000 > now)
    .reverse();
  const past = classes.filter(
    (c) => toDate(c.starts_at).getTime() + c.duration_min * 60000 <= now
  );

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
        🎥 Video runs on Jitsi Meet — each class gets its own private room link, visible only to
        people enrolled here.
        {access.as === "teacher" &&
          " Join a couple of minutes early: the first person to start the room may be asked by Jitsi to sign in (Google/GitHub) to become moderator."}{" "}
        Recordings and auto-attendance arrive in v1.1.
      </p>

      {access.as === "teacher" && (
        <form action={scheduleClass} className="card space-y-3">
          <input type="hidden" name="subject_id" value={subjectId} />
          <h3 className="font-semibold">Schedule a live class</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="label" htmlFor="title">Title *</label>
              <input className="input" id="title" name="title" placeholder="e.g. Chapter 5 revision" required />
            </div>
            <div>
              <label className="label" htmlFor="starts_at">Starts at *</label>
              <input className="input" id="starts_at" name="starts_at" type="datetime-local" required />
            </div>
            <div>
              <label className="label" htmlFor="duration_min">Duration (minutes)</label>
              <input className="input" id="duration_min" name="duration_min" type="number" min={10} defaultValue={60} />
            </div>
            <div className="flex items-end">
              <button className="btn w-full justify-center">Schedule</button>
            </div>
          </div>
        </form>
      )}

      <section>
        <h3 className="font-semibold">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No upcoming classes scheduled.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {upcoming.map((c) => {
              const startMs = toDate(c.starts_at).getTime();
              const live = startMs <= now && now < startMs + c.duration_min * 60000;
              return (
                <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium">
                      {c.title}
                      {live && (
                        <span className="badge ml-2 bg-red-100 text-red-700">● Live now</span>
                      )}
                    </h4>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {fmtDateTime(c.starts_at)} ({fmtRelative(c.starts_at)}) · {c.duration_min} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.room_code && (
                      <a
                        href={`https://meet.jit.si/${c.room_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={live ? "btn bg-red-600 hover:bg-red-700" : "btn"}
                      >
                        {live ? "● Join now" : "Join class"}
                      </a>
                    )}
                    {access.as === "teacher" && (
                      <form action={deleteClass}>
                        <input type="hidden" name="class_id" value={c.id} />
                        <button className="btn-danger">Cancel</button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h3 className="font-semibold text-slate-600">Past classes</h3>
          <div className="mt-2 space-y-2">
            {past.map((c) => (
              <div key={c.id} className="card flex items-center justify-between py-3 opacity-70">
                <div>
                  <h4 className="text-sm font-medium">{c.title}</h4>
                  <p className="text-xs text-slate-500">
                    {fmtDateTime(c.starts_at)} · {c.duration_min} min
                  </p>
                </div>
                {access.as === "teacher" && (
                  <form action={deleteClass}>
                    <input type="hidden" name="class_id" value={c.id} />
                    <button className="text-xs text-red-500 hover:underline">Remove</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
