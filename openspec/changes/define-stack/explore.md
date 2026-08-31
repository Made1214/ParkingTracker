# Exploration: define-stack — Technology Stack & Initial Architecture for Parking Tracker MVP

## Summary

Confirm **Supabase** for data/auth/storage (RLS-native design fits the PRD's core security bet) accessed via a **user-scoped client everywhere + narrow RPC/`SECURITY DEFINER` functions** for atomic cross-table logic — never a blanket `service_role` client — so RLS stays the single source of truth. For the frontend, **Next.js (App Router)** is the pragmatic default (official Supabase SSR guide, Vercel-native hosting), but a **Vite SPA is a legitimate lower-complexity alternative** given how little of this product is public/SEO-relevant — this is a real fork, not a forced conclusion. Use a **feature-sliced structure** (no hexagonal layer, no monorepo) mapped directly to the 13 PRD modules. Pair **TanStack Query with Supabase Realtime** subscriptions for live votes/RSVP. Use **shadcn/ui + Tailwind**, budgeting early time for shared money/chart primitives. Adopt **Vitest + Playwright + pgTAP** once the stack lands, and re-evaluate `strict_tdd` at that point.

**Before writing a proposal, the Vercel Hobby commercial-use ToS conflict needs an explicit decision from the user** — it directly contradicts the PRD's stated "near-zero infrastructure cost for year one" assumption.

**Ready for proposal:** Yes — with that one open decision surfaced first.

## Current State

Greenfield repository. Only `README.md`, `.gitignore`, and `docs/01-PRD-Parking-Tracker.md` exist — no code, no framework, no test runner. The PRD (v1.0, approved) states an INTENT, not a locked decision, to use Supabase (Auth/Postgres/Storage/RLS) + Vercel, both on free tiers, as an explicit business objective (PRD §3.2, §10.2). Team: 8 developers, 12-week MVP, mobile-first, Spanish-only UI, 13 MVP modules (PRD §7.1).

## Affected Areas

- `docs/01-PRD-Parking-Tracker.md` — sole source of truth for scope; no SRS/architecture doc exists yet (PRD §11 lists this as a pending next step).
- No source tree exists yet; this decision defines the initial `src/` layout for all future SDD changes.

## Approaches

### 1. Frontend framework

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **Next.js (App Router)** | First-party on Vercel (zero-config, image optimization for gallery, edge middleware for session refresh); official `@supabase/ssr` guide exists; only framework with production-ready RSC; largest hiring/onboarding pool for 8 devs in 12 weeks | RSC/server-client split adds ceremony most screens don't need — nearly everything is behind auth and group-private (US-02: "Solo los miembros del grupo ven su contenido"), so SSR's main win (SEO/public content) barely applies here | Low (well-trodden path) |
| **React + Vite SPA** | Simplest mental model: browser calls `supabase-js` directly, RLS is the only authorization layer; builds to 100% static output → **zero serverless function invocations** for hosting the app itself, preserving Vercel free-tier headroom | No SSR session-refresh middleware pattern; protected routes need a client-side auth guard, which can flash unauthenticated UI briefly on slow mobile networks | Low |
| **TanStack Start** | Best end-to-end type-safe routing; hit 1.0/stable in late 2024 | Smaller ecosystem/hiring pool than Next.js; RSC support experimental; more onboarding risk for 8 devs on a 12-week clock | Medium |
| **Remix / React Router 7** | Loader/action model maps cleanly onto Supabase server clients; as of 2026 Remix has been absorbed into React Router 7 (same project now) | Fewer Supabase-specific official guides than Next.js; RSC not production-ready | Medium |

**Honest note**: Next.js's headline feature (RSC) is not a strong fit here — this is a private, interactive, CRUD+realtime app, not a content/SEO site. The case for Next.js rests on ecosystem size, official Supabase SSR docs, and Vercel-native hosting — not RSC. A Vite SPA is a legitimate, lower-complexity alternative given how little of this product is actually public.

### 2. Talking to Supabase (drives RLS design — hard to reverse)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **Pure client-side `supabase-js`, RLS as sole authZ** | One mental model; RLS is unambiguously the single source of truth; simplest for 8 devs to reason about | Multi-step atomic operations (vote tally, expense balances, invite-code join) need to live somewhere — plain client calls make these race-prone | Low |
| **Server-only (Server Actions/Route Handlers) with a service layer** | Centralizes validation; easier to unit-test business logic | **Splits authorization across two places if the server layer starts using `service_role` "for convenience"** — the exact anti-pattern the PRD's #1 risk (§10.1, "Seguridad... RLS en todas las tablas desde el día 1") warns against | Medium |
| **Recommended hybrid** | Client or server both use the **user-scoped** Supabase client (cookie- or anon-key-based) for normal reads/writes — RLS enforces every call regardless of caller. Multi-table atomic logic (vote tallying, expense balance calc, invite-code redemption) lives in **Postgres functions (RPC, `SECURITY DEFINER` only where strictly needed)** — narrow, reviewable, RLS-adjacent. `service_role` key is reserved for a short explicit whitelist of privileged RPCs, never for blanket reads, and never shipped to the client | Requires an early written convention ("service_role is only ever called from these N named RPCs") so 8 devs don't each reach for it out of convenience | Medium |

This keeps **RLS as the single, non-negotiable source of truth** — any client-side role check (e.g., hiding a delete button for non-admins, per US-08 "los administradores pueden eliminar cualquiera") is UX sugar only; the real enforcement must also exist as an RLS policy.

### 3. Project architecture for 13 modules / 8 developers

Modules per PRD §7.1: auth, groups, events, RSVP, agenda, proposals+voting, comments, expenses, tasks, gallery, history, statistics.

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **Feature-sliced / screaming architecture** (`src/features/{module}/{components,hooks,api,types}`, `src/shared`, thin `entities`/cross-read layer) | Maps 1:1 to the PRD's module table; each of 8 devs/pairs owns clear folders → minimal merge conflicts; structure "screams" the domain | Cross-cutting reads (statistics reads across events/expenses/RSVP) need an explicit shared read layer or they turn into feature-to-feature imports | Low–Medium |
| **Layered (horizontal controllers/services/repositories)** | Familiar, enforces separation of concerns | Forces 8 parallel workers into the same few shared folders → merge-conflict magnet; wrong shape for parallel velocity in 12 weeks | Medium |
| **Monorepo with packages (Turborepo/pnpm workspaces)** | Strongest boundary enforcement via real package APIs | Tooling setup cost eats into the 12-week clock; overkill for one deployable app with no separate services | High |
| **Hexagonal/clean (ports & adapters, infra-agnostic domain)** | Would decouple domain logic from Supabase | **Not worth it here, honestly**: hexagonal pays off when you expect to swap infrastructure. The PRD explicitly commits to Supabase (cost objective + RLS-native design) for the foreseeable future — building a persistence-agnostic domain layer to guard against a swap that isn't planned is speculative generality the team can't afford in 12 weeks while also learning the stack | High |

**Recommended module pairing for 8 devs** (dependency-aware): auth+groups first (blocks everything, 1-2 devs, weeks 1-2) → events+RSVP+agenda as one tightly-coupled owner/pair → proposals+voting paired with whoever builds the realtime plumbing (reused by RSVP counts too) → expenses as a solo-ownable module (distinct balance/settlement logic) → comments/tasks/gallery as lighter "second modules" → history+statistics **last**, since both are read-only aggregations over other modules' data shapes and will churn if built early.

### 4. Data fetching and state (live voting + RSVP counts)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **TanStack Query alone** | Caching, dedupe, optimistic mutations (1-click RSVP per US-04), loading/error states | Pull-based only — cannot push live vote results (US-06: "los resultados se ven en tiempo real") without polling | Low |
| **Framework-native fetching only** (Next.js fetch cache / RR7 loaders) | Great for first paint / initial SSR data | Same problem: request-response only, no push updates to an already-open page | Low |
| **Supabase Realtime subscriptions in raw component state** | True push updates via Postgres Changes (CDC) | No caching/dedup across components, no built-in loading/error/retry semantics, manual subscription lifecycle management everywhere | Medium |
| **Recommended: TanStack Query + Realtime subscription writing into the Query cache** | Best of both — Query handles fetch/cache/optimistic UI, a small shared `useRealtimeQuery(table, filter)` hook calls `setQueryData`/`invalidateQueries` on Postgres Changes events for votes/RSVP/comments | One shared hook to build and reuse correctly across 3+ features | Medium |

### 5. UI component layer (mobile-first, Spanish UI, 12-week clock)

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **shadcn/ui + Tailwind** | Copy-paste primitives (no version-bump dependency), smallest baseline bundle since you only ship what you copy, huge current (2026) ecosystem/AI-tooling mindshare, integrates natively with Tailwind utility classes for consistent mobile breakpoints | You own the copied code — needs early internal conventions so 8 devs don't diverge on button/dialog variants; no built-in DataTable/date-picker/charts — must compose separately (relevant for expenses & statistics, US-07/US-09) | Low–Medium |
| **Mantine** | 120+ ready components incl. date pickers, currency-style number inputs, charts wrapper — much faster for expenses/statistics forms | Own CSS-Modules styling engine, not Tailwind — mixing it with any Tailwind usage creates two styling systems in one app, a real consistency risk across 8 devs in 12 weeks; heavier baseline bundle for mobile | Low |
| **MUI** | Mature, huge component set | Material look needs heavy theming to avoid a generic feel; historically heavier bundle than both alternatives; steeper API learning curve slows onboarding | Medium |

**Recommendation**: shadcn/ui + Tailwind for bundle-size/mobile priority, but budget explicit early time for a shared `MoneyInput` and a chart primitive (e.g. TanStack Table + Recharts) in `shared/ui` — otherwise expenses and statistics will each reinvent these independently.

### 6. Testing stack

- No runner exists yet — this is why `sdd-init`'s `strict_tdd` flag is currently `false`. That is a placeholder for "nothing to run yet," **not** a decision against TDD — re-evaluate immediately once the runner lands.
- **Vitest** + React Testing Library for unit/component tests — fast ESM transform, works with either Next.js or a Vite SPA, co-locatable per feature slice.
- **Playwright** for E2E — already installed as a Claude Code plugin (zero new install cost). Critical here specifically because RLS bugs are UI-visible failures (e.g., group A's data leaking into group B's UI) that unit tests alone won't catch.
- **Supabase CLI local stack + pgTAP** (or plain SQL assertions in CI) for RLS **policy** tests — a DB-level test category independent of Vitest/Playwright, directly answering the PRD's top risk (§10.1: RLS on every table from day one).

### 7. Money/tier risks (verified against current 2026 pricing pages)

| Risk area | Current free-tier limit | MVP trigger | Mitigation |
|---|---|---|---|
| **Vercel Hobby commercial-use restriction** | Hobby ToS/Fair Use Guidelines define "commercial usage" as *any deployment used for the financial gain of anyone involved in its production, including a paid employee or consultant writing the code* | An 8-developer team building this (presumably paid, even if end-users pay nothing) plausibly already qualifies as commercial usage under Vercel's own definition | **This directly conflicts with PRD §10.2's assumption that free tiers cover year one.** Needs an explicit decision before proposal: budget for Vercel Pro (~$20/developer/month per current pricing pages) or accept the ToS risk (Vercel can disable a Hobby deployment "with or without notice") |
| Supabase Storage | 1 GB total | 10 MB/photo cap + client compression (PRD §10.1 mitigation) still likely yields only ~500-1,000 photos across all groups before hitting the ceiling — plausible within weeks at ≥5 active groups, not months | Per-group storage quotas + compression are not optional polish — they must ship day 1, as the PRD's own risk table already states |
| Supabase DB size | 500 MB | Comments/expenses/RSVP rows are tiny; photos live in Storage, not the DB | Low risk — unlikely to bind during MVP |
| Supabase egress | 5 GB DB egress + 5 GB storage egress/month | Gallery viewing (repeat photo loads by up to 20 members/group) is the main driver | Serve compressed thumbnails/derivatives generated at upload time (US-08 already implies "miniaturas") rather than full-res on every view |
| Supabase project auto-pause | Free projects pause after 7 days of inactivity | Directly threatens PRD's own success metric (§9: "Grupos activos: ≥1 evento en últimos 30 días") — slow early adoption between pilot groups could pause the whole project, looking like an outage | Cheap scheduled keep-alive (e.g., a low-frequency Vercel Cron hitting a health endpoint) if adoption is uneven |
| Supabase Realtime | 200 concurrent connections, 2M messages/month | 5 groups × ≤20 members = 100 max concurrent — comfortably under the ceiling at MVP scale | No action needed now; note as the next ceiling if adoption exceeds the 3-month target |

## Recommendation

Confirm Supabase for data/auth/storage (RLS-native design, PRD's core security bet is sound and matches the tooling) and use it via a **user-scoped client everywhere + narrow RPC/`SECURITY DEFINER` functions for atomic cross-table logic**, never a blanket `service_role` client, so RLS stays the single source of truth. For the frontend, Next.js (App Router) is the pragmatic default given the official Supabase SSR guide and Vercel-native hosting, but flag honestly that a Vite SPA is a legitimate lower-complexity alternative given how little of this product is actually public/SEO-relevant — this is a real fork, not a forced conclusion. Use a feature-sliced structure (no hexagonal layer, no monorepo) mapped directly to the 13 PRD modules. Pair TanStack Query with Supabase Realtime subscriptions for live votes/RSVP. Use shadcn/ui + Tailwind, budgeting early time for shared money/chart primitives. Adopt Vitest + Playwright + pgTAP once the stack lands, and re-evaluate `strict_tdd` at that point. **Before writing a proposal, the Vercel Hobby commercial-use ToS conflict needs an explicit decision from the user** — it directly contradicts the PRD's stated "near-zero infrastructure cost for year one" assumption.

## Risks

- Vercel Hobby plan's ToS commercial-use restriction plausibly conflicts with an 8-developer paid build effort, contradicting PRD §10.2's free-tier cost assumption — needs a decision before `sdd-propose`.
- Supabase Storage 1 GB free-tier ceiling can be hit within weeks at the PRD's own adoption target (≥5 active groups), even with the PRD's stated mitigations — those mitigations must ship in the MVP, not be deferred.
- Supabase free-project auto-pause after 7 days of inactivity could look like a production outage during early, uneven adoption — needs a cheap keep-alive decision.
- Frontend framework and Supabase access-pattern decisions are coupled: choosing a Vite SPA implies pure client-side `supabase-js` with RLS as sole authZ; choosing Next.js implies deciding server vs. client Supabase clients per operation. This should be resolved as one decision in `sdd-propose`, not two independent ones.
- No SRS/architecture doc exists yet (PRD §11 next steps) — this exploration doubles as that missing input for `sdd-propose`.

## Ready for Proposal

Yes — with one explicit open decision the orchestrator should surface to the user before `sdd-propose`: whether to accept the Vercel Hobby commercial-use ToS risk, budget for Vercel Pro, or evaluate an alternative host, since it affects the "near-zero cost" business objective directly.

---

Sources consulted: Supabase pricing/free-tier pages (2026), Vercel Hobby plan docs + Fair Use Guidelines + Terms of Service, Supabase `@supabase/ssr` Next.js server-side auth guide, current (2026) framework/library comparison sources for TanStack Start/Remix-React Router 7 merger and shadcn/ui vs Mantine.
