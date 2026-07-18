# OnlineCoaching

Teacher–student learning platform (MVP of `PRD-Teaching-App.md`): subject enrollment with join codes, announcements, assignments with submissions and feedback, topic-based discussion forum, and class scheduling.

## Stack

- Next.js 15 (App Router, server components + server actions — no separate API layer)
- Toggleable database backend: PostgreSQL via `pg` (Neon free tier) or Turso/SQLite via `@libsql/client` — see Database driver toggle below
- Tailwind CSS v4
- Session auth with scrypt-hashed passwords (`lib/auth.ts`)

All mutations live in `lib/actions.ts`; every action re-checks the caller's role and subject membership server-side (`lib/access.ts`), per the PRD's requirement that permissions are enforced beyond the UI. Submission file uploads (≤5 MB) are stored as a binary column (`BYTEA` on Postgres, `BLOB` on SQLite) so there is no dependence on local disk — required because Render's free tier has an ephemeral filesystem.

The app creates its schema and demo seed data automatically on the first request against an empty database (`lib/db-postgres.ts` / `lib/db-sqlite.ts`), so a fresh database — local or cloud, either backend — needs no manual setup.

## Database driver toggle

`DB_DRIVER` selects the backend: `postgres` (default) or `turso`. This is a build-time/redeploy toggle, not a live in-app switch — same as changing `DATABASE_URL` today.

- `lib/db.ts` is a thin dispatcher; `lib/db-postgres.ts` and `lib/db-sqlite.ts` are the two adapters, each with its own schema (Postgres: `SERIAL`/`TIMESTAMPTZ`/`BYTEA`; SQLite: `INTEGER PRIMARY KEY AUTOINCREMENT`/ISO-8601 `TEXT`/`BLOB`) and seed logic.
- Query call sites use one shared syntax (`$1, $2, …` placeholders, `CAST(x AS INTEGER)` instead of `::int`, `LOWER(col) LIKE LOWER(pattern)` instead of `ILIKE`, JS-computed timestamps bound as parameters instead of inline `now()`/`interval`) so the same SQL text runs on both engines — the SQLite adapter translates `$N` → `?N` and coerces booleans to `0`/`1` internally.
- For Postgres: set `DATABASE_URL` (see below).
- For Turso: set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`. For local testing with no Turso account, use a local file instead: `TURSO_DATABASE_URL=file:./data/local.db` (leave `TURSO_AUTH_TOKEN` unset).

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
- **Neon:** compute auto-suspends after ~5 min idle and resumes on the next query (a few hundred ms delay). 0.5 GB storage on the free plan (same cap as Supabase free tier) — keep an eye on usage (`SELECT pg_size_pretty(pg_database_size(current_database()));`). The paid Launch/Scale tiers have no fixed monthly fee — pure pay-as-you-go ($0.35/GB-month storage, $0.106/CU-hour compute) — cheap for low/spiky usage, but per-GB storage is actually pricier than Supabase's Pro overage rate at real scale.
- **Turso** (if `DB_DRIVER=turso`): free tier is 5GB storage — 10x Neon/Supabase's 0.5GB — with usage-based overage ($1/GB) beyond that.

## Scope notes vs. the PRD

Implemented (MVP / v1 per the PRD's release plan): teacher & student enrollment (join codes, approval mode, add-by-email, remove/leave), announcements (post/edit/delete, acknowledge reactions, ack counts), assignments (due dates, late policy, resubmission, file/text submissions, tracker, score + feedback), discussion forum (threads, one-level nested replies, upvotes, pin/lock/delete moderation, keyword search), class scheduling with live video.

Live video is **built in** (no Jitsi or other third-party video service): every scheduled class gets an unguessable room slug, and `/call/<room>` hosts a browser-native WebRTC mesh call — participants stream directly to each other, with offers/answers/ICE candidates exchanged by polling `/api/call/<room>`, which stores them in two DB tables (`call_peers`, `call_signals`). Joining requires being the subject's teacher or an actively enrolled student (checked server-side on both the page and the signaling API), so unlike the old public-Jitsi links, a leaked URL alone is not enough to get in.

Caveats of the mesh design: every participant uploads their stream to every other participant, so it's sized for one-to-one and small groups (~4 people) — larger classes need an SFU/media server (self-hosted Jitsi or LiveKit, or a hosted SDK such as Daily — the v1.1 upgrade path, along with recordings and auto-attendance, FR-6.5/6.6). Connectivity uses free Google STUN by default; peers behind carrier-grade NAT (common on Jio/Airtel mobile data) may need a TURN relay — set `NEXT_PUBLIC_TURN_URL` (+ `NEXT_PUBLIC_TURN_USERNAME`/`NEXT_PUBLIC_TURN_CREDENTIAL`) at build time to enable one (Cloudflare and Metered/OpenRelay have free tiers). Signaling polls the database roughly every 1–4 s per participant during a call — fine for small usage, but worth remembering on Neon's free tier.

Deferred, matching the PRD's own phasing: video recordings + attendance logs (v1.1), notifications via push/email (in-app badges only), CSV bulk enrollment (v1.2), OTP/SSO login, scheduled announcements, profanity filtering, virus scanning.
