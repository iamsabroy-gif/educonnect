import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/lib/actions";

export const metadata: Metadata = {
  title: "EduConnect",
  description: "One place for teachers and students: classes, assignments, discussions.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                E
              </span>
              <span className="text-lg font-semibold tracking-tight">EduConnect</span>
            </Link>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-slate-600 sm:block">
                  {user.name}
                  <span
                    className={`badge ml-2 ${
                      user.role === "teacher"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {user.role}
                  </span>
                </span>
                <form action={logout}>
                  <button className="btn-secondary">Log out</button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn-secondary">
                  Log in
                </Link>
                <Link href="/signup" className="btn">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
