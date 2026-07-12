import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">
            <span className="badge mr-2 bg-slate-900 text-white">Admin</span>
            Platform console
          </h1>
          <nav className="flex gap-1">
            <Link href="/admin" className="btn-ghost">
              Overview
            </Link>
            <Link href="/admin/users" className="btn-ghost">
              Users
            </Link>
            <Link href="/admin/activity" className="btn-ghost">
              Activity
            </Link>
          </nav>
        </div>
        <Link href="/dashboard" className="btn-secondary">
          ← Back to app
        </Link>
      </div>
      {children}
    </div>
  );
}
