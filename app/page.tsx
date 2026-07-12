import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const features = [
    ["📢", "Announcements", "One-way broadcast from teacher to every enrolled student."],
    ["📝", "Assignments", "Distribute work, collect submissions, track status, give feedback."],
    ["💬", "Discussions", "Topic-based threads with replies, upvotes, and moderation."],
    ["🎥", "Live classes", "Schedule sessions and meet in private Jitsi video rooms."],
  ];

  return (
    <div className="py-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          One place for your classes
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          OnlineCoaching brings enrollment, announcements, assignments, and discussions
          together — so teachers stop juggling WhatsApp, email, and Zoom.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn text-base">
            Get started
          </Link>
          <Link href="/login" className="btn-secondary text-base">
            Log in
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Demo accounts: teacher@demo.com / student@demo.com (password: demo1234)
        </p>
      </div>
      <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2">
        {features.map(([icon, title, desc]) => (
          <div key={title} className="card">
            <div className="text-2xl">{icon}</div>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
