# CLAUDE.md

Guidance for Claude Code (and any contributor) working in this repository.

## Commit authorship

**Every commit is authored and committed as the repository owner, never as
`Claude` or any other agent identity.** Before the first commit of a
session, set the identity for this repository:

```bash
git config user.name "Madelaine Arosemena"
git config user.email "116743110+Made1214@users.noreply.github.com"
```

Commit messages carry **no agent attribution trailers**: no
`Co-Authored-By:` line and no `Claude-Session:` line, even if the tooling
suggests adding them.

Check `git log -1 --format='%an <%ae> | %cn <%ce>'` before pushing. If a
commit went out under another identity, rewrite it
(`git commit --amend --reset-author`) and update the branch.

## Database migrations

**Every schema change is a new numbered file under `supabase/migrations/`.
Never edit a migration that has already been applied to Prod or Staging.**

### Why not a single schema file

Neither the PRD nor the ClickUp tasks require one file per table — that
granularity was a deliberate choice, not a requirement. What both agree on
is that schema changes go through Supabase's migration mechanism
(`supabase migration new ...`), and that mechanism assumes **migrations are
immutable once applied**:

- Supabase (and every serious migration tool — Flyway, Prisma, Rails) tracks
  *which migrations already ran* per environment. If you edit an applied
  file instead of adding a new one, the tool has no record that anything
  changed, and Staging vs. Prod silently drift apart running two different
  versions of "the same" migration.
- Numbered files are what let you promote a change from Staging to Prod
  with confidence: you know exactly what has and hasn't been applied to
  each environment by comparing filenames, not by diffing schema dumps.

A single big file is not inherently wrong for a first migration, but once a
schema is live anywhere, edits become new files — no exceptions.

### Rules

1. **Never edit a migration file that has already been applied to any
   environment (Staging or Prod).** If a change is needed, write a new
   migration that alters what the old one created.
2. **Filenames are strictly ordered**: `NNN_description.sql`, zero-padded,
   no gaps, no duplicates. The next migration continues the existing
   sequence — check `ls supabase/migrations/` for the last number before
   creating a new one.
3. **RLS lives in the same migration as the table it protects**, never a
   later one. A table is never committed without `ENABLE ROW LEVEL
   SECURITY` and at least one policy — see
   [`.claude/plans/necesito-que-leas-el-snoopy-stonebraker.md`](.claude/plans/necesito-que-leas-el-snoopy-stonebraker.md)
   for the full authorization model (helper functions, tenant-integrity
   composite FKs, `FORCE ROW LEVEL SECURITY`, `security_invoker` views).
4. **Every migration is applied to Staging first**, verified there
   (pgTAP + `get_advisors`), and only then applied to Prod with the exact
   same file. Never hand-write a different version of a change for Prod.
5. **Dependency order matters at CREATE FUNCTION time for `language sql`
   functions** — Postgres validates table references immediately, not
   lazily. If a helper function reads a table (e.g. `group_members`), that
   table must already exist. `language plpgsql` defers validation to
   runtime and does not have this constraint. This is why the core tables
   (`profiles`, `groups`, `group_members`) are created in one migration
   *before* the helper functions that read them, with RLS added in a
   later migration once the helpers exist.
6. After applying a migration to a project, run `get_advisors` (both
   `security` and `performance`) before moving to the next one. A missing
   RLS policy or a `security_definer` view is an ERROR-level finding, not
   a style suggestion.

### Environments

- **Parking Tracker Prod** (`oooiuzofkjvfquaexxsl`) — canonical schema,
  applied first. Carries the full historical migration sequence,
  including `020_storage_policies.sql` / `022_photos_cloudinary.sql` /
  `023_drop_supabase_storage_policies.sql`, which correct an earlier
  Supabase-Storage-based design to Cloudinary.
- **Parking Tracker Staging** (`xyubdpmdrvaxvtiwbnro`) — mirrors Prod's
  *end state*, not its full file-by-file history: it was created after
  the Cloudinary decision, so its `016_photos.sql`-equivalent went in
  already shaped for Cloudinary, and it never applied 020/022/023 at
  all. This is where development and testing happen, including the seed
  data (`supabase/seed.sql`, once it exists). Prod never receives
  seed/test data.
- From here forward, **every new migration is applied to Staging first**,
  verified there, then applied to Prod with the exact same file and
  number — the two stay in lockstep going forward even though their
  early history diverges by a few files.

### Data access

The app uses the **Supabase client** (`@supabase/supabase-js` +
`@supabase/ssr`), always user-scoped (anon key + session JWT) — never
`service_role` in application code. Because every table is reachable via
PostgREST, **RLS is the only boundary between private group data and the
open internet**, not an optional extra layer. See the plan file linked
above for the complete reasoning (roles/grants, `SECURITY DEFINER` helper
functions, why `group_id` is denormalized onto every table, and the
composite-FK mechanism that stops cross-tenant writes RLS alone can't see).

### Media (gallery photos)

Gallery photos (PRD US-08) are hosted on **Cloudinary**, not Supabase
Storage — this superseded the original plan after `define-stack` was
approved (see `openspec/changes/define-stack/design.md` §7). Cloudinary
has **no RLS**, so it cannot itself answer "is this caller a member of
this photo's group?" — only Postgres can. Consequences that apply to any
code touching photos:

1. **Never construct or expose a Cloudinary delivery URL on the client.**
   The client always asks the server for one; the server re-checks
   `is_group_member(group_id)` (the same check already gating the
   `photos` row's RLS policy) before signing a short-lived delivery URL.
   A `cloudinary_public_id` alone is never sufficient authorization.
2. **Never ship the Cloudinary API secret to the client.** Uploads are
   signed server-side (signed-upload params), same shape as the delivery
   check above.
3. The `photos` table's schema (`022_photos_cloudinary.sql`) stores
   `cloudinary_public_id`/`cloudinary_version`, not a storage path — the
   RLS policies on `photos` itself are unchanged from the original
   design (still gate on `is_group_member(group_id)`).
4. `next/image` stays banned on gallery assets, now to avoid re-optimizing
   an already-signed URL rather than for the original Vercel Hobby
   transformation-cap reason — that cap no longer applies once photos
   are Cloudinary-served.
