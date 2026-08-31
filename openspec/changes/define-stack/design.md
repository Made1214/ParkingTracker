# Design: define-stack — Foundational Architecture

## Technical Approach

A single Next.js (App Router) application, installable as a PWA, talking to Supabase through a **user-scoped client only**. Authorization lives entirely in Postgres RLS; the application layer never decides who may see what. Source is **feature-sliced**, one directory per MVP module, with a public-API rule per slice so 8 developers can work in parallel. Atomic multi-table logic lives in Postgres functions. Media is compressed client-side and served straight from Supabase Storage, never through `next/image`.

The stack is settled by the proposal and is not revisited here. Rejected alternatives are recorded in one line each at the end.

---

## 1. Folder Structure

### Slice list — authoritative source is PRD §7.1

**12 slices, one per PRD §7.1 module row.** (The number 13 in circulation belongs to PRD §5, which lists use cases CU-01…CU-13 — a different table. Modules and use cases are not the same list.)

| PRD §7.1 row | Slice |
|---|---|
| Autenticación | `auth` |
| Grupos | `groups` |
| Eventos | `events` |
| Asistencia | `rsvp` |
| Cronograma | `agenda` |
| Propuestas y votaciones | `proposals` |
| Comentarios | `comments` |
| Gastos | `expenses` |
| Tareas | `tasks` |
| Galería | `gallery` |
| Historial | `history` |
| Estadísticas | `statistics` |

Two notes on shape, neither of which changes the count:

- **`proposals` owns two data models** — a proposal (free text) and a poll (options, votes, close date) — because PRD §7.1 scopes them as one module. It is therefore the heaviest slice; internally it separates `api/proposals.ts` from `api/polls.ts`. Treat it as a two-developer slice, not a one-developer slice.
- **`history` and `statistics` own no tables.** They are read-only consumers of other slices.

```
parking-tracker/
├── src/
│   ├── app/                              # Routing ONLY — no business logic
│   │   ├── (auth)/login|register|callback/
│   │   ├── (app)/groups/[groupId]/
│   │   │        └── events/[eventId]/{agenda,polls,expenses,gallery,...}/
│   │   ├── api/health/route.ts           # keep-alive target (see §9)
│   │   ├── manifest.ts                   # PWA manifest (typed metadata route)
│   │   └── layout.tsx
│   ├── features/
│   │   ├── auth/  groups/  events/  rsvp/  agenda/
│   │   ├── proposals/       # proposals AND polls/votes (PRD §7.1 scopes them as one)
│   │   ├── comments/  expenses/  tasks/
│   │   └── gallery/  history/  statistics/
│   └── shared/
│       ├── ui/          # shadcn primitives + MoneyInput, Chart, EmptyState
│       ├── supabase/    # client.ts, server.ts, types.generated.ts
│       ├── query/       # queryClient.ts, useRealtimeQuery.ts
│       ├── media/       # compressImage.ts, uploadPhoto.ts
│       ├── pwa/         # useInstallPrompt.ts, registerServiceWorker.ts
│       └── lib/         # date, currency, env
├── supabase/
│   ├── migrations/      # schema + RLS in the SAME migration
│   ├── tests/           # pgTAP policy tests
│   └── SECURITY_DEFINER.md   # the whitelist (§4)
├── e2e/                 # Playwright
└── public/              # icons, sw.js, offline.html
```

### Slice shape (identical for all 12)

```
features/{module}/
├── components/     # module-owned React components
├── hooks/          # TanStack Query hooks (useEvents, useCreateEvent)
├── api/            # the ONLY place in the slice that touches Supabase
├── types.ts
└── index.ts        # PUBLIC API — the only file other slices may import
```

### Ownership rules (these are what prevent merge collisions)

| # | Rule | Enforcement |
|---|---|---|
| O1 | A slice may import from `shared/*` and from another slice's `index.ts`. **Deep imports across slices are forbidden.** | ESLint `no-restricted-imports` on `features/*/!(index)` |
| O2 | `src/app/` files are thin: they resolve params, render one feature component, and nothing else. This keeps the shared routing tree out of the merge path. | Code review |
| O3 | `history` and `statistics` read other modules through their `index.ts` or a dedicated SQL view/RPC. They never own tables. | Review + migration ownership |
| O4 | **Promotion rule: two slices duplicate, three slices promote.** Code moves into `shared/` only when a *third* consumer appears, in a PR that touches `shared/` plus the callers and nothing else. | Review |
| O5 | One owner (or pair) per slice for the whole MVP. Ordering: `auth`+`groups` → `events`+`rsvp`+`agenda` → `proposals` (pair — it carries two data models and the realtime plumbing) → `expenses` → `comments`/`tasks`/`gallery` → `history`+`statistics` last. | Assignment doc |

---

## 2. Supabase Access Pattern

| File | Client | Key | Used for |
|---|---|---|---|
| `shared/supabase/client.ts` | browser (`createBrowserClient`) | anon | Everything in components/hooks. Default path. |
| `shared/supabase/server.ts` | server-from-cookies (`createServerClient`) | anon + user JWT | Only: root layout session read, route-group redirect, Server Actions that call an RPC. |
| `middleware.ts` | server | anon + user JWT | **Session cookie refresh only.** May redirect for UX. Never a data gate. |

Both clients are **user-scoped**. The user's JWT rides on every request, `auth.uid()` resolves in Postgres, and RLS decides. There is no third client.

### Forbidden — application code MUST NOT

| Forbidden | Correct approach |
|---|---|
| Import or reference `SUPABASE_SERVICE_ROLE_KEY` anywhere under `src/` | User-scoped client + RLS. If elevation is truly needed, it is a whitelisted RPC (§4). |
| Prefix any Supabase secret with `NEXT_PUBLIC_` | Only the URL and anon key are public. |
| Gate a write solely on a client-side role check (`if (isAdmin)`) | The client check is UX sugar; a matching RLS policy is **mandatory** and is the real gate. |
| Fetch broadly and filter rows in JS for security | RLS returns only permitted rows. JS filtering is presentation only. |
| Trust a `group_id` or `user_id` sent from the client as an authorization input | Policies derive identity from `auth.uid()`; the client-supplied id is only a selector. |
| Issue multiple dependent writes from the client that must succeed together | One RPC call (§4). |
| Ship a migration that creates a table without `enable row level security` | Same-migration RLS is a CI-checked rule. |

CI guard: a grep step fails the build if `service_role` appears under `src/`.

---

## 3. RLS Policy Model

### The hinge: group membership

Every policy in the system reduces to one question — *is `auth.uid()` a member of this row's group?*

```sql
create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.group_members gm
  where gm.group_id = p_group_id and gm.user_id = auth.uid()); $$;

-- is_group_admin(p_group_id) — identical shape, adds  and gm.role = 'admin'
```

`security definer` is **required** here: a policy on `group_members` that queries `group_members` recurses infinitely. The definer function breaks the recursion. This is the single most common Supabase RLS failure mode and is why the helper exists.

**Every group-scoped table carries `group_id uuid not null`, denormalized even onto event-children.** Cost: one redundant column plus a FK. Benefit: every policy is a single indexed membership check with no joins, so every slice writes policies of the same shape and reviewers can verify them at a glance.

### Default recipe for any new table

1. `group_id uuid not null references groups(id) on delete cascade` + index on `(group_id)`
2. `alter table ... enable row level security;` **in the same migration**
3. Four policies (select / insert / update / delete), all `to authenticated`
4. A pgTAP test proving a non-member sees zero rows — **PR fails without it**

### Worked example — `expenses`

```sql
alter table public.expenses enable row level security;

create policy expenses_select on public.expenses for select to authenticated
  using (public.is_group_member(group_id));

create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());

create policy expenses_update on public.expenses for update to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id))
  with check (public.is_group_member(group_id));

create policy expenses_delete on public.expenses for delete to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id));
```

The `anon` role is granted nothing on any application table.

---

## 4. RPC / SECURITY DEFINER Functions

Default is **SECURITY INVOKER**. Elevation is only justified when the caller provably *cannot* have a policy permitting the operation.

| Function | Signature | Mode | Atomic guarantee |
|---|---|---|---|
| Invite join (US-02) | `join_group_by_invite(p_code text) returns uuid` | **DEFINER** | Validates the code (exists, active, not expired), inserts `group_members` with `on conflict do nothing` (idempotent — a double-clicked link cannot create two memberships), records redemption, returns `group_id`. Elevation is unavoidable: the caller is by definition *not yet* a member, so no membership policy can allow the read or the insert. This is also why `group_members` has **no client-facing INSERT policy** — this function is the only door in. |
| Cast vote (US-06) | `cast_vote(p_poll_id uuid, p_option_ids uuid[]) returns void` | INVOKER | In one transaction: membership check, poll-open check (`status='open' and closes_at > now()`), arity check (2–10 options, single vs. multiple per `allow_multiple`), then delete the caller's prior votes and insert the new set. A changed vote can never be observed as double-counted. |
| Tally (US-06) | `get_poll_results(p_poll_id uuid) returns table(option_id uuid, label text, votes int, is_winner bool)` | INVOKER | Single-statement aggregate; the winner is computed in the same snapshot as the counts, so results can never disagree with the highlighted option. |
| Balances (US-07) | `get_group_balances(p_group_id uuid) returns table(user_id uuid, net_amount numeric)` | INVOKER | All expenses and splits read in one snapshot; net amounts **sum to zero by construction**. |
| Transfers (US-07) | `suggest_settlements(p_group_id uuid) returns table(from_user uuid, to_user uuid, amount numeric)` | INVOKER | Greedy min-cash-flow over the same snapshot as `get_group_balances`, with a deterministic `user_id` tie-break so two clients always render the identical transfer list. |

### SECURITY DEFINER rules (all four, non-negotiable)

1. **Pin `set search_path = ''`** in the definition and fully qualify every name (`public.x`). Without this, a caller-controlled `search_path` can shadow a table and hijack an elevated function.
2. **The first statements in the body are explicit authorization checks.** RLS is bypassed inside a definer function, so the function *is* the authorization boundary.
3. `revoke execute ... from public, anon; grant execute ... to authenticated;`
4. Listed in `supabase/SECURITY_DEFINER.md` with a written justification, added only by PR with two reviewers.

MVP whitelist: `is_group_member`, `is_group_admin`, `join_group_by_invite`. Nothing else.

---

## 5. Data Fetching and Realtime

**The TanStack Query cache is the single source of truth. Realtime holds no state — it only invalidates.**

```
User A votes
  │
  ├─ mutation ──→ rpc('cast_vote') ──→ Postgres (RLS + one transaction)
  │                                          │
  │                                    Postgres Changes
  │                                          ▼
  │                                  Supabase Realtime
  │                          ┌───────────────┴───────────────┐
  ▼                     User A client                  User B client
optimistic patch of            │                             │
A's OWN vote only        invalidateQueries            invalidateQueries
                               └──────────────┬──────────────┘
                                 refetch get_poll_results (through RLS)
```

`shared/query/useRealtimeQuery.ts` wraps `useQuery` plus a Postgres Changes channel:

- **Ref-counted channels.** N components sharing a `queryKey` open **one** channel; it closes on last unmount. This is what keeps the 200-concurrent-connection ceiling irrelevant at 5 groups × 20 members.
- **On event → `invalidateQueries(queryKey)`, never `setQueryData(payload)`.** The realtime payload is a raw row; the authoritative shape for votes and RSVP is an *aggregate*. Patching the cache with a raw row would mean reimplementing the tally client-side — a second source of truth that will drift. Cost of invalidating is one round-trip; that is the right trade at this scale.
- **250 ms trailing debounce per queryKey**, so twenty near-simultaneous votes produce one refetch, not twenty.
- **Optimistic updates are allowed only on the user's own row** (the 1-click RSVP of US-04, which must feel instant). Never optimistic on a count or a balance — the invalidate reconciles those.

Applied to: `proposals` (live poll results), `rsvp` (live counters), `comments`. Not applied to `history`/`statistics`, which are intentionally static reads.

---

## 6. PWA Implementation

**Manifest** — `src/app/manifest.ts` (typed metadata route) emitting `display: "standalone"`, `start_url: "/"`, `lang: "es"`, theme/background colors, 192/512 icons plus a maskable variant, and screenshots for the richer Android install UI.

**Service worker** — `public/sw.js`, registered from a client component after hydration.

| Request class | Strategy | Why |
|---|---|---|
| `/_next/static/*` | Cache-first, immutable | Content-hashed, safe forever |
| Navigations | Network-first + `offline.html` fallback | Group data must be fresh; the fallback prevents a dead tab |
| `**/rest/v1`, `**/auth/v1`, realtime | **Network-only. Never cached.** | Caching an authorized response risks serving group A's data to group B on a shared device after logout. This is a C1 violation. |
| Supabase Storage images | Stale-while-revalidate, capped entries + max-age | Cuts storage egress on repeat gallery views |

Hard rule: the SW never caches a response that carried an `Authorization` header or a Supabase session cookie.

**Install-prompt flow** (`shared/pwa/useInstallPrompt.ts`) — load-bearing, because on **iOS 16.4+ Web Push only works after the PWA is on the home screen**, and Web Push is the top post-MVP item (PRD §8).

1. Chromium: capture and defer `beforeinstallprompt`; expose `promptInstall()`.
2. **iOS/Safari has no `beforeinstallprompt`.** Detect iOS and `!navigator.standalone`, then show an instructional sheet ("Compartir → Añadir a pantalla de inicio"). This manual path is the *only* route to notifications on iOS.
3. Trigger after the first high-value action (first group join or first RSVP), never on first load. Dismissal persisted with a cooldown; at most 2 prompts ever.
4. Record install state via the `display-mode: standalone` media query.
5. **Do not request notification permission in the MVP.** This flow exists solely to unblock it later.

`VERIFY AT IMPLEMENTATION` — SW tooling candidates: `@serwist/next`, Workbox (`workbox-build` + hand-written `sw.ts`), or a dependency-free hand-rolled SW. `next-pwa` is a candidate but must be checked for maintenance status. Icon generation candidates: `pwa-asset-generator`, or a `sharp` script. Confirm current maintenance and Next.js version compatibility before choosing; no package here is assumed current.

---

## 7. Media Pipeline (binding cost constraint C2/C3)

Flow: **select → validate → compress in a worker → 2 derivatives → upload → DB row → quota trigger**.

| Stage | Rule |
|---|---|
| Validate | MIME in `image/jpeg|png|webp`; **≤ 10 MB pre-compression** (US-08). Rejected client-side *and* by a storage policy. |
| Compress | Web Worker: `createImageBitmap` → `OffscreenCanvas` → `convertToBlob({type:'image/webp'})`. Produces `full` (longest edge 1920 px, ~300 KB target) and `thumb` (400 px, ~40 KB). |
| Store | Private bucket, path `photos/{group_id}/{event_id}/{photo_id}_{full\|thumb}.webp`. Storage RLS policies key off the first path segment via `is_group_member(...)`. |
| Serve | **Short-lived signed URLs (~1 h)** held in the Query cache. A public bucket would leak group-private photos to anyone holding a URL — a C1 violation. Grid renders `thumb`; `full` loads only when the lightbox opens. |
| Render | Plain `<img loading="lazy">` with explicit `width`/`height`. |
| Quota | `group_storage_usage(group_id, bytes_used, bytes_quota)`, default **100 MB/group**. A `BEFORE INSERT` trigger rejects an upload that would exceed it; usage is recomputed on insert and delete. The gallery shows a usage bar. |

### `next/image` is banned on Storage assets (C2)

Vercel Hobby caps image transformations at 5,000/month. Enforcement is layered, strongest first:

1. **Do not add the Supabase Storage hostname to `next.config` `images.remotePatterns`.** `next/image` then fails loudly on those URLs the first time anyone tries — in development, immediately.
2. ESLint rule: no `next/image` import inside `features/gallery` or `features/history`.
3. Review rule, written in the slice README.

`next/image` remains available for the handful of bundled static app assets.

**Gotcha to handle:** canvas re-encoding drops EXIF. That is a privacy win (location metadata is stripped), but EXIF **orientation must be read and applied before re-encode**, or iPhone photos land sideways.

`VERIFY AT IMPLEMENTATION` — compression library candidates: `browser-image-compression`, `compressorjs`, or a dependency-free Canvas/OffscreenCanvas implementation. Also verify `OffscreenCanvas` support in the current iOS Safari; if it is unreliable, fall back to a main-thread canvas path.

---

## 8. Testing Setup

| Layer | Tool | Scope | Gate |
|---|---|---|---|
| Unit / component | Vitest + React Testing Library (jsdom) | Settlement algorithm, currency and date formatting, compression sizing, slice components. Colocated `*.test.ts(x)`. | CI |
| **RLS policy** | **pgTAP** via `supabase test db` | Per table: a non-member **sees 0 rows, cannot insert, cannot update, cannot delete**. Admin-only paths. Every `SECURITY DEFINER` function. | **CI blocking. A new table without a policy test fails the PR.** |
| RPC contract | pgTAP | `join_group_by_invite` rejects invalid/expired codes and is idempotent; `cast_vote` enforces arity and open state; `get_group_balances` sums to zero. | CI blocking |
| E2E | Playwright (already available) | Two-context test: a member of group A cannot reach group B's event by direct URL. Invite link → join → RSVP. Upload → thumbnail visible. | CI on PR |

RLS policy tests are the mechanism that holds down the PRD's #1 risk (§10.1). They are not optional and they are not deferrable to QA.

The pgTAP mechanism that makes this work is impersonation inside a transaction — `set local role authenticated;` plus `set local request.jwt.claims = '{"sub":"<uuid>"}';` — which is what makes `auth.uid()` resolve to a test user. `VERIFY AT IMPLEMENTATION`: the exact claim-setting syntax for the current Supabase CLI version.

`strict_tdd` is currently `false` only because no runner exists. Flip it to `true` and re-record in `sdd-init` once Vitest, Playwright, and pgTAP are installed.

---

## 9. RESOLVED — Supabase 7-Day Auto-Pause

**Decision: implement a daily keep-alive AND document the behavior in the README. Do not rely on documentation alone.**

**Mechanism.** A Vercel Cron job calls `GET /api/health`, which performs one trivial database read and returns `{ "ok": true }` and nothing else. The endpoint requires no auth and exposes no data. Daily frequency is ample against a 7-day threshold — even a 6-day cron would do.

**Why this, and the tradeoff.**

| Option | Verdict |
|---|---|
| **Daily keep-alive + document it** | **Chosen.** Costs ~30 of 1,000,000 monthly function invocations — rounding error. The honest cost is different: *a keep-alive masks genuine inactivity.* "Is anyone using this?" must therefore be answered by product analytics (events created per group, per PRD §9), never by whether the database happens to be awake. Accepting that decoupling is the price. |
| Accept and document only | Rejected. A 7-day gap between pilot groups is entirely plausible during validation. A "project paused" screen at that moment reads to a user as *the app is broken* — which feeds the PRD's #1 risk, low adoption versus WhatsApp inertia (§10.1). Preventing it costs about ten lines of code. Documenting a self-inflicted outage is not a mitigation. |
| Client-side ping | Rejected. It only fires when somebody opens the app, which is precisely the case that already fails. |
| Paid tier | Out of scope. Guaranteed uptime is a budget decision, not an architecture one, and no budget exists (proposal, hosting rationale). |

**Boundary to state plainly:** a cron keep-alive prevents the *inactivity* pause. It is not an uptime guarantee and does not cover Supabase-side incidents. If the product ever needs a real SLA, that is a paid-tier conversation, not a cron-frequency conversation.

`VERIFY AT IMPLEMENTATION`: the current Vercel Hobby cron frequency limit (historically Hobby has been restricted relative to paid plans). If the limit is once daily, that already satisfies the requirement.

---

## Architecture Decisions Summary

| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
| Authorization | RLS only, user-scoped client only | Service layer with `service_role` | Two authorization sources drift; one goes stale and group-private data leaks (PRD §10.1) |
| Atomic logic | Postgres RPC, INVOKER by default | Client-side multi-step writes | Race-free by transaction; authorization stays in one place |
| Elevation | DEFINER only when no policy *can* permit the call | DEFINER by default for convenience | Each DEFINER function becomes its own authorization boundary — minimize the count |
| Group scoping | `group_id` denormalized onto every table | Join through parent to reach the group | Every policy becomes one indexed check of identical shape; reviewable at a glance |
| Realtime | Invalidate the Query cache | Write payloads into component or cache state | Aggregates (tallies, counts, balances) cannot be derived from a single raw row without duplicating logic |
| Gallery serving | Signed URLs + plain `<img>` | `next/image` | Vercel Hobby: 5,000 transformations/month (C2) |
| Photo bucket | Private + signed URLs | Public bucket | A public bucket leaks group-private photos to any URL holder (C1) |
| Structure | Feature-sliced, `index.ts` public API | Hexagonal / monorepo | Setup cost is not repaid when infrastructure is not expected to change; ownership boundaries are what 8 parallel developers actually need |
| Auto-pause | Daily cron keep-alive | Accept and document | A pause during validation reads as an outage and feeds the top adoption risk |

Settled earlier and recorded only for the record: Vite SPA (team knows Next.js), React Native (an app install between the invite link and the RSVP breaks the exact mitigation for the #1 risk), hexagonal layering and monorepo (cost not repaid at 8 developers / 12 weeks).

---

## Items Requiring Verification at Implementation

No package below is asserted to be current, maintained, or recommended. Each must be checked at implementation time.

| Area | Candidates | What to verify |
|---|---|---|
| Service worker tooling | `@serwist/next`, Workbox + hand-written SW, dependency-free SW, `next-pwa` | Maintenance status; compatibility with the Next.js version actually installed |
| PWA icon generation | `pwa-asset-generator`, `sharp` script | Maintenance status |
| Client image compression | `browser-image-compression`, `compressorjs`, hand-rolled Canvas | Maintenance status; `OffscreenCanvas` reliability in current iOS Safari |
| pgTAP user impersonation | Supabase CLI | Exact `request.jwt.claims` syntax for the installed CLI version |
| Vercel Hobby cron limits | Vercel docs | Current minimum cron frequency on Hobby |
| Supabase JS / SSR client factories | `@supabase/supabase-js`, `@supabase/ssr` | Current cookie-handling API surface (it has changed across majors) |

---

## Migration / Rollout

No data migration — greenfield. Rollout order is dependency-driven: `shared/supabase` + membership schema + `is_group_member` + the first pgTAP test land **first**, because every other slice inherits that shape. `auth` and `groups` follow, then the event cluster. `history` and `statistics` land last; they aggregate over other modules' shapes and would churn if built early.

## Open Questions

None blocking. The auto-pause question is resolved in §9. The proposal's standing team confirmation on Vercel Hobby (nobody paid, no monetization) remains a business condition, not an architectural one.
