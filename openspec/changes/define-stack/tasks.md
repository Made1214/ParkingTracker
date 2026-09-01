# Tasks: define-stack — Foundational Architecture

Source of truth: `proposal.md` (decisions/scope), `design.md` (concrete shape), `specs/*.md` (acceptance criteria).
This checklist covers **foundation only** — no business behavior for any of the 12 feature modules (auth, groups,
events, rsvp, agenda, proposals, comments, expenses, tasks, gallery, history, statistics).

## Scope note (reconciliation, not a re-opened decision)

`design.md` §4 lists five RPC functions (`join_group_by_invite`, `cast_vote`, `get_poll_results`,
`get_group_balances`, `suggest_settlements`) as the target RPC catalog for the MVP as a whole. Four of them
(`cast_vote`, `get_poll_results`, `get_group_balances`, `suggest_settlements`) operate on tables owned by the
`proposals` and `expenses` feature modules, which `proposal.md`'s **Out of scope** section explicitly excludes from
this change ("no events, no RSVP, no expenses" — "this change produces the shape, not the product"). Those tables
do not exist yet, so those four functions cannot be built here without doing feature work.

The design's own **MVP whitelist** line confirms the narrower scope for this change: *"is_group_member,
is_group_admin, join_group_by_invite. Nothing else."* Task work below builds exactly those three functions.
The other four RPCs are correctly deferred to the `proposals` and `expenses` module changes, where their backing
tables and the RPC convention established here (§4 SECURITY DEFINER rules, §3 RLS recipe) will apply directly.

---

## Work Units

### WU-1 — Repository scaffold
**Depends on**: nothing (first task, no code dependencies)
**Spec**: `project-foundation` — Working Scaffold; Environment and Config Handling
**Size estimate**: ~350 changed lines

- [ ] Scaffold Next.js App Router project with TypeScript, ESLint, Tailwind (`create-next-app` or manual init)
- [ ] Install and configure shadcn/ui; add baseline primitives (Button, Card, Input)
- [ ] Add `.env.example` listing every required variable (Supabase URL/anon key, Google OAuth) with no real values
- [ ] Add fail-fast env validation at startup (missing required var → clear startup error, not a silent fallback)
- [ ] Configure lint/format baseline (ESLint + Prettier) and a `package.json` single-command install/dev/build
- [ ] Add minimal CI workflow stub: lint, typecheck, build jobs (green on clean clone)
- [ ] **Verify**: fresh clone → install → dev boots with no manual post-clone steps (spec scenario: "Clean clone boots")

### WU-2 — Supabase CLI + pgTAP harness bootstrap
**Depends on**: WU-1
**Spec**: `testing-foundation` — Dedicated RLS Policy Test Category (harness only; first real test lands in WU-4)
**Size estimate**: ~120 changed lines

- [ ] `supabase init`; commit `supabase/config.toml` and `supabase/migrations/` (empty, ready for WU-4)
- [ ] Add `supabase/tests/` directory for pgTAP files
- [ ] Add CI job that runs `supabase test db` as its own step, distinguishable from unit/E2E jobs in CI output
- [ ] Document local pgTAP run command in README

### WU-3 — Supabase client conventions
**Depends on**: WU-1
**Spec**: `data-access-authorization` — User-Scoped Client by Default
**Size estimate**: ~150 changed lines

- [ ] `shared/supabase/client.ts` — browser client (`createBrowserClient`, anon key)
- [ ] `shared/supabase/server.ts` — server-from-cookies client (`createServerClient`, anon key + user JWT)
- [ ] `middleware.ts` — session cookie refresh only (no data-gating logic)
- [ ] **VERIFY AT IMPLEMENTATION**: confirm current `@supabase/supabase-js` / `@supabase/ssr` cookie-handling API
  surface before wiring `server.ts`/`middleware.ts` — the API has changed across majors (design §"Items Requiring
  Verification")
- [ ] Confirm no `SUPABASE_SERVICE_ROLE_KEY` reference anywhere under `src/` (manual check, backstopped by WU-13's CI grep)

### WU-4 — Membership schema, RLS, `is_group_member`/`is_group_admin`, first pgTAP test
**FIRST-LANDING WORK UNIT** — every other slice inherits this shape (design §"Migration/Rollout")
**Depends on**: WU-2, WU-3
**Spec**: `data-access-authorization` — RLS Is the Sole Authorization Authority; RLS Policy Coverage Testable in CI
**Size estimate**: ~250 changed lines

- [ ] Migration: `groups` table (id, name, invite_code, timestamps)
- [ ] Migration: `group_members` table (group_id, user_id, role) with `group_id` index
- [ ] `alter table ... enable row level security` in the **same migration** as table creation (both tables)
- [ ] `is_group_member(p_group_id uuid)` — `SECURITY DEFINER`, `set search_path = ''`, per design §3 exact shape
- [ ] `is_group_admin(p_group_id uuid)` — identical shape, adds `role = 'admin'`
- [ ] Four policies (select/insert/update/delete, `to authenticated`) on `group_members` — note: `group_members` has
  **no client-facing INSERT policy**; only `join_group_by_invite` (WU-6) may insert
- [ ] `revoke execute ... from public, anon; grant execute ... to authenticated;` on both helper functions
- [ ] pgTAP test: non-member of group A querying `group_members`/`groups` for group B sees **zero rows**
- [ ] **VERIFY AT IMPLEMENTATION**: exact `set local role authenticated; set local request.jwt.claims = ...` syntax
  for the installed Supabase CLI version (design §8)
- [ ] Start `supabase/SECURITY_DEFINER.md` with `is_group_member` and `is_group_admin` entries and justification

### WU-5a — Shared skeleton, slice import boundary, module ownership
**Depends on**: WU-1
**Spec**: `project-foundation` — Feature-Sliced Module Structure (shared has no feature logic); Module Ownership
**Size estimate**: ~80 changed lines

- [ ] Create `src/shared/{ui,supabase,query,media,pwa,lib}/` directories (empty/placeholder where not yet built)
- [ ] ESLint `no-restricted-imports` rule: block deep imports into `features/*/!(index)` (design O1)
- [ ] Write module ownership document — one named owner (or pair) per each of the 12 module directories, reviewable
  by all 8 developers; encode the design's dependency-aware assignment order (O5)

### WU-5b — Feature-sliced scaffold for the 12 MVP modules
**Depends on**: WU-5a
**Spec**: `project-foundation` — Feature-Sliced Module Structure; Internal Slice Convention
**Size estimate**: ~330 changed lines

- [ ] Create `src/features/{auth,groups,events,rsvp,agenda,proposals,comments,expenses,tasks,gallery,history,statistics}/`
- [ ] Each slice gets identical shape: `components/`, `hooks/`, `api/`, `types.ts`, `index.ts` (public API) — stub
  content only, no business logic
- [ ] `proposals/api/` split into `proposals.ts` and `polls.ts` stubs (two data models, one slice — design note)
- [ ] `history/` and `statistics/` slices marked (comment + ownership doc note) as read-only, own-no-tables consumers
- [ ] **Verify**: `src/features/` listing shows exactly 12 directories, none missing or merged (spec scenario)

### WU-6 — `join_group_by_invite` RPC + whitelist doc
**Depends on**: WU-4
**Spec**: `data-access-authorization` — Multi-Table Atomic Operations via RPC/SECURITY DEFINER
**Size estimate**: ~150 changed lines

- [ ] `join_group_by_invite(p_code text) returns uuid` — `SECURITY DEFINER`, `set search_path = ''`
- [ ] Body: validate code (exists, active, not expired) → insert `group_members` with `on conflict do nothing`
  (idempotent) → record redemption → return `group_id`
- [ ] First statements are explicit authorization/validation checks (design §4 rule 2)
- [ ] `revoke execute ... from public, anon; grant execute ... to authenticated;`
- [ ] pgTAP: valid code creates exactly one membership row, atomically
- [ ] pgTAP: invalid/expired code creates no membership row and the caller receives a rejection
- [ ] pgTAP: double-submitting the same valid code does not create a second membership row (idempotency)
- [ ] Add `join_group_by_invite` entry to `supabase/SECURITY_DEFINER.md` (whitelist now complete: 3 functions)

### WU-7 — PWA shell
**Depends on**: WU-1
**Spec**: `pwa-delivery` — all four requirements
**Size estimate**: ~350 changed lines

- [ ] `src/app/manifest.ts` (typed metadata route): name, 192/512 + maskable icons, `start_url`, `display: standalone`,
  `lang: "es"`, theme/background colors, screenshots
- [ ] **VERIFY AT IMPLEMENTATION**: choose icon generation tooling (`pwa-asset-generator` vs. a `sharp` script) —
  check current maintenance status before committing to one
- [ ] **VERIFY AT IMPLEMENTATION**: choose service worker tooling (`@serwist/next`, Workbox, hand-rolled SW,
  `next-pwa`) — check maintenance status and Next.js version compatibility before committing to one
- [ ] `public/sw.js` + `public/offline.html`: cache-first for `/_next/static/*`; network-first + offline fallback for
  navigations; **network-only, never cached** for `**/rest/v1`, `**/auth/v1`, realtime, and Cloudinary delivery URLs
  (C1 — never cache a response carrying an `Authorization` header/session cookie, and never cache a short-lived
  signed URL past its own expiry)
  Registration from a client component after hydration
- [ ] `shared/pwa/useInstallPrompt.ts`: capture/defer `beforeinstallprompt` (Chromium); detect iOS + `!navigator.standalone`
  and show manual "Add to Home Screen" instructional sheet; trigger after first high-value action (group join or
  first RSVP), never on first load; dismissal persisted with a cooldown, max 2 prompts ever
- [ ] Record install state via `display-mode: standalone` media query
- [ ] Do **not** request notification permission (out of scope — foundation only)
- [ ] Document/verify the iOS 16.4+ home-screen-install prerequisite for future Web Push is met by this flow
  (no push implemented) — satisfies "Foundation for Future Web Push"

### WU-8 — Media pipeline (Cloudinary — supersedes the original Supabase Storage plan, see design.md §7)
**Depends on**: WU-3, WU-4
**Spec**: `media-storage-budget` — all five requirements
**Size estimate**: ~220 changed lines (smaller than the original Storage plan: no Web Worker/compression code needed)

- [ ] Client-side validate: MIME in `image/jpeg|png|webp`, ≤ 10 MB, visible rejection error (not silent)
- [ ] **VERIFY AT IMPLEMENTATION**: choose Cloudinary SDK (`cloudinary` Node SDK vs. `next-cloudinary`) — check
  maintenance status and compatibility with the Next.js runtime (Node vs. Edge) the upload route runs in
- [ ] Server route/Server Action: generate Cloudinary signed-upload parameters using the API secret (server-only,
  never shipped to the client), `type: authenticated`
- [ ] Client uploads directly to Cloudinary using the signed params; on success, insert the `photos` row
  (`cloudinary_public_id`, `bytes`, `width`, `height`, `event_id`, `group_id`, `uploaded_by`)
- [ ] RLS policies on `photos` unchanged from the original plan — still gate on `is_group_member(group_id)` (depends
  on WU-4)
- [ ] Server route/Server Action: generate a short-lived signed **delivery** URL only after re-checking
  `is_group_member(group_id)` for the requesting user — the client never constructs a Cloudinary URL itself
- [ ] `CHECK` constraint on the `photos` table enforces the 10 MB cap (must not depend solely on client-side check)
- [ ] `group_storage_usage(group_id, bytes_used, bytes_quota)` table/function, default 100 MB/group
- [ ] `BEFORE INSERT` trigger on `photos` rejects a row that would exceed group quota; usage recomputed on insert
  and delete
- [ ] ESLint rule: no `next/image` import inside `features/gallery` or `features/history`
- [ ] pgTAP: oversized `photos` insert rejected by the `CHECK` constraint even when the client check is bypassed
- [ ] pgTAP: `photos` insert at/over group quota is rejected; insert under quota succeeds and usage increases
- [ ] pgTAP/integration: a non-member requesting a delivery URL is refused, even when supplying a valid
  `cloudinary_public_id` for another group's photo

### WU-9 — Unit/component test runner
**Depends on**: WU-1
**Spec**: `testing-foundation` — Unit and Component Test Runner Available
**Size estimate**: ~120 changed lines

- [ ] Install and configure Vitest + React Testing Library (jsdom environment)
- [ ] Colocated `*.test.ts(x)` convention documented
- [ ] At least one passing example test (e.g., a currency/date formatting util) proving runner + config + CI wiring
  work end-to-end
- [ ] Wire `pnpm test` into CI as its own job

### WU-10 — E2E test runner
**Depends on**: WU-1, WU-4
**Spec**: `testing-foundation` — End-to-End Test Runner Available
**Size estimate**: ~150 changed lines

- [ ] Install and configure Playwright, running against a built instance of the app in CI
- [ ] Seed helper for two test users in two different groups (uses WU-4's schema)
- [ ] At least one passing example E2E test: a member of group A cannot reach group B's event by direct URL
  (two-context test per design §8)
- [ ] Wire Playwright into CI as its own job

### WU-11 — Full CI gate + strict_tdd decision
**Depends on**: WU-2, WU-9, WU-10
**Spec**: `testing-foundation` — CI Test Gate on Merge; Strict TDD Mode Re-Evaluation Recorded
**Size estimate**: ~180 changed lines

- [ ] Combine lint, typecheck, build, unit (Vitest), E2E (Playwright), and RLS/pgTAP jobs in one CI workflow, each a
  distinguishable step/job
- [ ] All jobs block merge on failure (branch protection or required-status-check configuration)
- [ ] Record the `strict_tdd` decision (enabled or not, with reasoning) now that all three runners are installed and
  green in CI — update `sdd-init` project context per proposal's risk item

### WU-12 — Vercel Cron keep-alive
**Depends on**: WU-1
**Spec**: none directly (design §9 resolved item; supports proposal risk "auto-pause after 7 days")
**Size estimate**: ~60 changed lines

- [ ] `GET /api/health` route: one trivial DB read, returns `{ "ok": true }`, no auth required, exposes no data
- [ ] `vercel.json` cron config calling the endpoint daily (or the platform minimum, whichever is more frequent)
- [ ] **VERIFY AT IMPLEMENTATION**: current Vercel Hobby minimum cron frequency — confirm daily is achievable; if the
  limit is coarser, document the actual configured frequency and confirm it still beats the 7-day pause window
- [ ] Document the auto-pause mitigation and its boundary (not an uptime SLA) in the README

### WU-13 — `service_role` CI guard + forbidden-patterns doc
**Depends on**: WU-3
**Spec**: `data-access-authorization` — User-Scoped Client by Default (client bundle inspection scenario)
**Size estimate**: ~50 changed lines

- [ ] CI grep step: fail the build if `service_role` (or `SUPABASE_SERVICE_ROLE_KEY`) appears anywhere under `src/`
- [ ] Document the "Forbidden — application code MUST NOT" table (design §2) in a slice-visible README section
- [ ] Confirm no Supabase secret is prefixed `NEXT_PUBLIC_` except URL and anon key

---

## Ordering Summary

```
WU-1 (repo scaffold)
 ├─→ WU-2 (pgTAP harness)  ─┐
 ├─→ WU-3 (Supabase clients) ┼─→ WU-4 (membership + RLS + is_group_member/admin + first pgTAP test)  [critical path]
 ├─→ WU-5a (shared skeleton, ownership, import rule) ─→ WU-5b (12 slice scaffolds)
 ├─→ WU-7 (PWA shell)
 ├─→ WU-9 (unit runner)
 └─→ WU-12 (cron keep-alive)

WU-4 ─→ WU-6 (join_group_by_invite RPC)
WU-4 + WU-3 ─→ WU-8 (media pipeline)
WU-4 + WU-1 ─→ WU-10 (E2E runner)
WU-3 ─→ WU-13 (service_role guard)
WU-2 + WU-9 + WU-10 ─→ WU-11 (full CI gate + strict_tdd decision)
```

Parallelizable once WU-1 lands: WU-2, WU-3, WU-5a, WU-7, WU-9, WU-12 (no cross-dependencies among them).
Sequential/blocking: WU-4 is the hinge — WU-6, WU-8, WU-10 all wait on it, matching the design's explicit rollout order.

---

## Review Workload Forecast

| Work unit | Est. changed lines |
|---|---|
| WU-1 Repo scaffold | 350 |
| WU-2 pgTAP harness | 120 |
| WU-3 Supabase client conventions | 150 |
| WU-4 Membership + RLS + is_group_member/admin + first pgTAP test | 250 |
| WU-5a Shared skeleton + ownership + import rule | 80 |
| WU-5b 12-module slice scaffold | 330 |
| WU-6 join_group_by_invite RPC + whitelist | 150 |
| WU-7 PWA shell | 350 |
| WU-8 Media pipeline | 320 |
| WU-9 Unit/component runner | 120 |
| WU-10 E2E runner | 150 |
| WU-11 Full CI gate + strict_tdd decision | 180 |
| WU-12 Vercel Cron keep-alive | 60 |
| WU-13 service_role CI guard | 50 |
| **Total** | **~2660** |

- **Estimated total changed lines**: ~2660
- **400-line budget risk**: High (total far exceeds 400; several individual work units — WU-1, WU-5b, WU-7, WU-8 — sit close to or would exceed 400 if combined with any neighbor)
- **Chained PRs recommended**: Yes

### Proposed PR chain

Each PR below is one work unit (or the smallest paired unit where a dependency is trivial), individually reviewable
in under an hour, targeting the previous PR's branch in sequence per the `chained-pr` standard (draft tracker PR
recommended as the base).

| # | PR scope | Depends on | Deliberately excludes |
|---|---|---|---|
| 1 | WU-1 Repo scaffold | none | any Supabase code, PWA, feature slices |
| 2 | WU-2 pgTAP harness + WU-3 Supabase clients | PR 1 | membership schema, any RPC |
| 3 | WU-4 Membership schema + RLS + helper functions + first pgTAP test | PR 2 | join RPC, any feature table |
| 4 | WU-5a Shared skeleton + ownership doc + import rule | PR 1 | slice stub content (PR 5) |
| 5 | WU-5b 12-module slice scaffold | PR 4 | any business logic inside slices |
| 6 | WU-6 join_group_by_invite RPC + whitelist doc | PR 3 | cast_vote/balances/etc. (out of scope, see Scope note) |
| 7 | WU-7 PWA shell | PR 1 | Web Push delivery |
| 8 | WU-8 Media pipeline | PR 2, PR 3 | gallery UI/business logic |
| 9 | WU-9 Unit/component runner | PR 1 | E2E, RLS test wiring |
| 10 | WU-10 E2E runner | PR 3, PR 1 | full CI gate (PR 11) |
| 11 | WU-11 Full CI gate + strict_tdd decision | PR 2, PR 9, PR 10 | new test content |
| 12 | WU-12 Vercel Cron keep-alive | PR 1 | uptime SLA claims |
| 13 | WU-13 service_role CI guard + forbidden-patterns doc | PR 2 | none — smallest slice |

- **Decision needed before apply**: Yes — confirm with the user whether to run this chain as a Feature Branch Chain
  (draft tracker PR, each child targeting its immediate parent per `chained-pr` standard) or as 13 independent
  PRs against `main` gated purely by the dependency table above. Also confirm sequencing priority: the design's
  rollout order requires PR 3 (WU-4) to land before PR 6, 8, and 10 — apply must not get ahead of that critical path.
