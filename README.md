# OnlineCoaching

Teacher–student learning platform (MVP of `PRD-Teaching-App.md`): subject enrollment with join codes, announcements, assignments with submissions and feedback, topic-based discussion forum, and class scheduling.

## Stack

- Next.js 15 (App Router, server components + server actions — no separate API layer)
- PostgreSQL via `pg` — same engine locally (Homebrew) and in production (Neon free tier)
- Tailwind CSS v4
- Session auth with scrypt-hashed passwords (`lib/auth.ts`)

All mutations live in `lib/actions.ts`; every action re-checks the caller's role and subject membership server-side (`lib/access.ts`), per the PRD's requirement that permissions are enforced beyond the UI. Submission file uploads (≤5 MB) are stored as `BYTEA` in Postgres so there is no dependence on local disk — required because Render's free tier has an ephemeral filesystem.

The app creates its schema and demo seed data automatically on the first request against an empty database (`lib/db.ts`), so a fresh Postgres — local or cloud — needs no manual setup.

## Admin console

`/admin/login` is a separate, static-credential login — entirely independent of the students/teachers table. Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env.local`/Render; anyone signing in there gets a signed, HttpOnly session cookie (`lib/admin-auth.ts`) scoped only to `/admin/*`, unrelated to the regular `onlinecoaching_session` cookie. Rotating `ADMIN_PASSWORD` immediately invalidates all existing admin sessions, since the password also signs the session token. The console shows platform totals and growth, a searchable per-user activity table (with an inactivity flag for teachers/students who haven't logged in in 30+ days), and a recent-activity feed across the whole platform.

## Run locally

```bash
brew services start postgresql@17   # once per boot; createdb educonnect if it doesn't exist
npm install
npm run dev                          # http://localhost:3000
```

`.env.local` points `DATABASE_URL` at the local `educonnect` database. To run locally against the production Neon database instead, swap in the pooled connection string (see `.env.example`).

Reset local data: `dropdb educonnect && createdb educonnect` (reseeds on next request).

## Demo accounts (password: `demo1234`)

| Role | Email |
|---|---|
| Teacher | teacher@demo.com |
| Student | student@demo.com |
| Student | diya@demo.com |
| Student | rohan@demo.com |

Seed includes one subject ("Mathematics — Class X", join code `MATH42`) with announcements, an assignment, a discussion thread, and a scheduled class.

## Deploy to Render (free tier)

Database: Neon free-tier project `neondb` (us-east-1). The app connects directly over Postgres and applies its own schema on first request — no separate migration step.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo (`render.yaml` configures a free Singapore web service).
3. Set the `DATABASE_URL` env var to the Neon **pooled connection** string
   (Neon dashboard → Connect → check "Pooled connection"):
   `postgresql://<user>:<password>@<endpoint>-pooler.<region>.aws.neon.tech/neondb?sslmode=require`
   (Reset the DB password under Project Settings → Reset password if you don't have it.)
4. Optionally set `ADMIN_USERNAME`/`ADMIN_PASSWORD` to enable `/admin/login` (see Admin console below).
5. Deploy. The app seeds demo data on first request.

Free-tier behavior to expect:

- **Render:** service spins down after ~15 min idle; the first request after that takes ~50 s (cold start). 750 instance-hours/month.
- **Neon:** compute auto-suspends after ~5 min idle and resumes on the next query (a few hundred ms delay). 0.5 GB storage on the free plan (same cap as Supabase free tier) — keep an eye on usage (`SELECT pg_size_pretty(pg_database_size(current_database()));`); upgrade to Neon Launch ($19/mo, 10 GB) if you approach the limit.

## Scope notes vs. the PRD

Implemented (MVP / v1 per the PRD's release plan): teacher & student enrollment (join codes, approval mode, add-by-email, remove/leave), announcements (post/edit/delete, acknowledge reactions, ack counts), assignments (due dates, late policy, resubmission, file/text submissions, tracker, score + feedback), discussion forum (threads, one-level nested replies, upvotes, pin/lock/delete moderation, keyword search), class scheduling with live video.

Live video uses the public **Jitsi Meet** instance (`meet.jit.si`): every scheduled class gets an unguessable room slug (`onlinecoaching-<random>`), and the join link renders only for the subject's teacher and enrolled students. No API keys or servers needed. Caveats: the first person to start a room may be asked by Jitsi to sign in (Google/GitHub) to become moderator — teachers should join a couple of minutes early; anyone who obtains the raw link can join (the slug is the only secret); recordings and auto-attendance (FR-6.5/6.6) are not included — that's the upgrade path to a token-based SDK such as Daily or Agora in v1.1.

Deferred, matching the PRD's own phasing: video recordings + attendance logs (v1.1), notifications via push/email (in-app badges only), CSV bulk enrollment (v1.2), OTP/SSO login, scheduled announcements, profanity filtering, virus scanning.
