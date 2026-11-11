# Parking Tracker

A collaborative web platform for organizing group outings — planning,
RSVPs, schedules, polls, shared expenses, photos, and stats. See the
[PRD](docs/01-PRD-Parking-Tracker.md) for the full product spec.

## Documentation

Project docs live in [docs/](docs/), including the [PRD](docs/01-PRD-Parking-Tracker.md).

Architecture and OpenSpec change history live in
[openspec/](openspec/), including the frozen stack decisions in
[openspec/changes/define-stack/](openspec/changes/define-stack/).

## Database

Multitenant Postgres schema on Supabase. The **group** is the tenant:
Row Level Security (RLS) is the sole authorization authority — every
group-scoped table is unreachable by any other group's members, enforced
in Postgres itself, not in application code. Data access goes through the
Supabase client (`@supabase/supabase-js` + `@supabase/ssr`), always
user-scoped (anon key + session JWT) — `service_role` is never used by
the app.

- **Schema**: 15 domain tables (Doc 04) + `group_storage_usage`, 6 native
  enums, `SECURITY DEFINER` helper functions (`is_group_member`,
  `is_group_admin`), composite foreign keys that prove tenant coherence
  (not just row existence — see `supabase/migrations/`), and two RPCs
  (`create_group`, `join_group_by_invite`) that are the only doors into
  group membership.
- **Migrations**: versioned, numbered files in
  [supabase/migrations/](supabase/migrations/), one schema change per
  file, applied in order and never edited once applied.
- **Environments**:
  - **Parking Tracker Prod** — canonical schema. Fully migrated
    (24 migrations applied), RLS forced on every table,
    `security_invoker` views, 0 security advisor findings.
  - **Parking Tracker Staging** — mirrors Prod's schema (applied
    Cloudinary-shaped from the start, so `020_storage_policies.sql`,
    `022_photos_cloudinary.sql` and `023_drop_supabase_storage_policies.sql`
    were skipped here — they only exist in Prod's history to correct an
    earlier decision). RLS forced on every table, 0 security advisor
    findings. Development, testing, and seed data happen here — `supabase/seed.sql`
    is loaded and verified against it (6 users, 1 group, 4 events across
    every status, fully populated finished event).
  - **Local (Docker)** — `supabase start` runs every migration in
    `supabase/migrations/` + seed from a clean database; used to run the pgTAP suite below with
    correctly scoped roles (the Supabase-hosted MCP connection used for
    Prod/Staging work is a superuser and bypasses RLS, so it can't
    validate isolation honestly). `analytics` and `studio` are disabled
    in `supabase/config.toml` — Logflare's local image has a known
    startup bug unrelated to this schema, and neither service is needed
    for Postgres/Auth/PostgREST-level testing.

Full design rationale (RLS policy shapes, the tenant-integrity attack
composite FKs close, `FORCE ROW LEVEL SECURITY`, view security, RPC
contracts) is documented inline in the migration files themselves.

## RLS test suite

[supabase/tests/](supabase/tests/) is a pgTAP suite (22 files, also run in
CI on every pull request) proving the isolation model actually holds — not just that
policies exist, but that a non-member gets zero rows, that the
composite-FK tenant-integrity mechanism rejects a cross-group write RLS
alone can't see, that `group_members` has no INSERT policy, that every
view enforces `security_invoker`, and a canary test proving the suite
itself would catch a dropped policy. Run it with:

```
supabase start   # local Docker stack; applies migrations + seed fresh
supabase test db # runs the full suite
supabase stop
```

## End-to-end tests

Playwright specs live in `e2e/` and run against the **built** app and a
database loaded with `supabase/seed.sql` (they sign in as the seed users and
register throwaway `e2e-…@example.com` accounts).

```bash
pnpm db:start                 # local Supabase with migrations + seed (Docker)
pnpm exec supabase status     # copy API URL and anon key into .env.local
pnpm exec playwright install chromium
pnpm build && pnpm test:e2e
```

They cover group isolation by direct URL, invite link → join → RSVP, live
comments between two sessions, and the PWA manifest and offline behavior. CI
runs them as their own job on every pull request. Set `E2E_BASE_URL` to target
a server that is already running, and `E2E_CHROMIUM_PATH` to reuse an
installed Chromium.

## Media (gallery photos)

Event gallery photos (PRD US-08) are hosted on **Cloudinary**, not
Supabase Storage. Cloudinary has no RLS of its own, so the app signs
every upload and every delivery URL server-side, only after re-checking
group membership (`is_group_member`) — the same authorization check that
already protects the `photos` table. Uploads are validated (≤ 10 MB) and
counted against a 100 MB per-group storage quota enforced by a database
trigger; a photo that fails the quota check never gets a `photos` row,
so it can never be served regardless of whether the Cloudinary upload
itself succeeded. See `supabase/migrations/022_photos_cloudinary.sql`
and [openspec/changes/define-stack/design.md](openspec/changes/define-stack/design.md)
§7 for the full flow.

## Health check & keep-alive (`GET /api/health`)

Supabase's free tier pauses projects after 7 days of inactivity ([design.md §9](openspec/changes/define-stack/design.md)). To prevent idle auto-pause:

- [`src/app/api/health/route.ts`](src/app/api/health/route.ts) performs a lightweight, data-free round-trip to Supabase using the standard anon client (`Cache-Control: no-store`, `dynamic = "force-dynamic"`) and returns `{ status: "ok", db: "ok", time }` (`200`) or `{ status: "error", db: "error", time }` (`503`).
- [`vercel.json`](vercel.json) schedules a daily Vercel Cron (`0 8 * * *`) against `/api/health`.
- **Optional auth**: if `HEALTH_CHECK_SECRET` or `CRON_SECRET` is set in the environment, `GET /api/health` requires `Authorization: Bearer <secret>` (Vercel Cron automatically sends `CRON_SECRET` as a Bearer token when configured in Vercel). Leave both unset to keep the endpoint publicly reachable.
