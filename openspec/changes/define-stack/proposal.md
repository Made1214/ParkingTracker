# Proposal: define-stack — Technology Stack and Initial Architecture

**Decision**: Build Parking Tracker as an installable **PWA on Next.js (App Router)**, backed by **Supabase** (Auth, Postgres, Storage), with **RLS as the sole authorization authority**, a **feature-sliced** source layout mapped 1:1 to the 13 MVP modules, hosted on **Vercel Hobby**.

## Intent

The PRD (v1.0, approved) states an *intent* to use Supabase and Vercel, not a locked technical decision. No source tree, framework, or test runner exists. Eight developers start a 12-week MVP with no agreed structure, no authorization model, and no cost ceilings written down.

This change freezes those decisions so parallel work can start without each module inventing its own answers.

**Success looks like**: a running scaffold every developer can clone, a written authorization rule nobody has to guess at, and folder ownership boundaries that keep 8 people out of each other's merge conflicts.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Frontend framework | **Next.js (App Router)** | Team familiarity on a 12-week clock. Recorded honestly: SSR/RSC does **not** earn its keep here — every screen is behind auth and group-private (US-02), so there is no SEO or public content. A Vite SPA was technically viable; Next.js won on the team, not on the technology. |
| Delivery model | **Installable PWA** | Native (React Native) rejected: an app install between the invite link and the RSVP attacks the exact mitigation the PRD names for its #1 risk, "low adoption vs WhatsApp inertia" (10.1) — invite-by-link (US-02) and 1-click RSVP (US-04). PRD 7.2 also excludes native from MVP. PWA gives home-screen install and Web Push (section 8, high priority post-MVP) without breaking the link flow. |
| Backend | **Supabase** (Auth, Postgres, Storage) | Confirms the PRD's stated intent; RLS-native design matches the product's core security bet. |
| Authorization | **RLS as the SOLE authority** | Splitting authZ between app code and the database creates two places to keep in sync; one goes stale and group-private data leaks. This is the PRD's #1 security risk (10.1). **Binding constraint, not a preference.** |
| Multi-table atomic logic | **Postgres RPC / `SECURITY DEFINER`** | Vote tallying, expense balances, invite-code join. Keeps atomicity in the database and authorization in one place. |
| Project structure | **Feature-sliced**, 1:1 with the 13 MVP modules | Clear ownership boundaries for 8 developers. Hexagonal/clean layering and a monorepo were rejected: they pay off when infrastructure is expected to change, which it is not, and their setup cost eats the 12-week budget. |
| Hosting | **Vercel Hobby (free)** | Hobby restricts commercial use, defined to include a paid employee or consultant writing the code. Nobody on the 8-person team is paid, and the MVP has no payments (7.2 excludes Stripe/PayPal), ads, affiliate links, or donations. No commercial trigger applies. PRD 3.2's near-zero-cost objective holds as written. |

## Binding constraints

These are not guidelines. Downstream design and implementation must satisfy them.

| # | Constraint | Consequence if violated |
|---|---|---|
| C1 | **RLS is the only authorization authority.** Every table has policies from day one. Client-side role checks (e.g. hiding an admin-only delete button) are UX sugar and must have a matching policy. `service_role` is never shipped to the client and never used for blanket reads. | Group-private data leaks — the PRD's #1 security risk. |
| C2 | **Gallery photos must NOT be served through `next/image`.** Vercel Hobby caps 5,000 image transformations/month and 300K image cache reads. Compress client-side; serve directly from Supabase Storage. | Gallery breaks or forces a paid upgrade within the MVP window. |
| C3 | **Supabase Storage is 1 GB and is the binding cost risk** — reachable within weeks at the PRD's own target of 5 active groups. Client-side compression, the 10 MB per-photo cap, and **per-group storage quotas ship IN the MVP.** They are not polish and are not deferrable. | Storage ceiling hit before validation completes; PRD 3.2 cost objective fails. |
| C4 | Remaining Hobby ceilings to design within: 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 4 CPU-hrs Active CPU, 1M function invocations/month. | Silent throttling under load. |

## Scope

### In scope

- Next.js App Router scaffold with TypeScript, Tailwind, and shadcn/ui primitives.
- `src/features/{module}/` feature-sliced layout mapped to the 13 PRD modules, plus `src/shared`.
- PWA setup: manifest, service worker, and a deliberate **install-prompt flow** (iOS 16.4+ requires home-screen install before Web Push works).
- Supabase client conventions: user-scoped client everywhere; a written, named whitelist of privileged RPCs.
- RLS policy conventions and the baseline schema approach for group-scoped tables.
- Storage conventions: client-side compression, 10 MB cap, thumbnail derivatives at upload, per-group quotas.
- Data layer conventions: TanStack Query paired with Supabase Realtime for live votes and RSVP counts.
- Test stack selection and installation: Vitest + React Testing Library, Playwright, pgTAP for RLS policy tests.
- Lint/format/CI baseline and module ownership assignment for 8 developers.

### Out of scope

- **Any feature implementation.** No auth screens, no events, no RSVP, no expenses, no gallery. This change produces the shape, not the product.
- Native mobile (PRD 7.2).
- Push notification delivery (PRD section 8, post-MVP) — only the PWA install foundation that unblocks it later.
- Payments, external calendars, multi-language (PRD 7.2).
- Monorepo tooling, hexagonal layering.

## Capabilities

### New capabilities

- `project-foundation`: repository scaffold, feature-sliced structure, tooling, CI baseline, module ownership.
- `data-access-authorization`: RLS-as-sole-authority rules, user-scoped Supabase client convention, `SECURITY DEFINER` RPC whitelist.
- `pwa-delivery`: manifest, service worker, offline shell baseline, install-prompt flow.
- `media-storage-budget`: client-side compression, size cap, thumbnail derivatives, per-group quotas, direct-from-Storage serving.
- `testing-foundation`: Vitest, Playwright, and pgTAP setup with the RLS policy test category.

### Modified capabilities

None — greenfield repository, no existing specs.

## Affected areas

| Area | Impact | Description |
|---|---|---|
| repository root | New | Next.js app, TypeScript, Tailwind, lint/format config |
| `src/features/*` | New | 13 module slices with `components/hooks/api/types` |
| `src/shared/*` | New | UI primitives, Supabase clients, `useRealtimeQuery` hook |
| `supabase/` | New | Migrations, RLS policies, RPC functions |
| `public/` | New | PWA manifest, icons, service worker |
| CI | New | Lint, typecheck, unit, E2E, and RLS policy test jobs |

## Risks and open items

| Risk / item | Likelihood | Mitigation / action |
|---|---|---|
| Supabase Storage 1 GB ceiling hit during validation | High | C3 mitigations ship in MVP; monitor per-group usage from week 1 |
| Supabase free project **auto-pauses after 7 days of inactivity**, appearing as an outage during uneven early adoption | Medium | Decide on a low-frequency keep-alive (e.g. Vercel Cron hitting a health endpoint) during design |
| `service_role` used "for convenience" by one of 8 developers | Medium | Written whitelist convention + code review rule; RLS policy tests in CI |
| `strict_tdd` is currently `false` **only because no test runner exists** | Certain | Re-evaluate and flip once Vitest/Playwright/pgTAP land in this change |
| iOS install-prompt flow discovered late, blocking Web Push later | Medium | Designed deliberately in this change, not deferred |
| 13 modules across 8 developers in 12 weeks | Medium | Dependency-aware ordering: auth+groups first; history+statistics last (read-only aggregations that churn if built early) |

**Team confirmation needed**: the Vercel Hobby decision rests on nobody on the team being paid for this work and the product carrying no monetization. If either changes, hosting must be revisited.

## Rollback plan

The repository is greenfield with no production deployment. Rollback is `git revert` of the scaffold commits — nothing depends on it yet. The high-cost reversal is structural: a framework or authorization-model change after feature work begins would touch every module, which is precisely why these decisions are being frozen now rather than discovered later.

## Dependencies

- Supabase project provisioned (free tier) with Google OAuth credentials.
- Vercel account linked to the repository.
- Supabase CLI installed locally for migrations and pgTAP.

## Success criteria

- [ ] `pnpm dev` runs the scaffold; `pnpm build` and CI pass on a clean clone.
- [ ] All 13 module slices exist with a documented ownership assignment.
- [ ] The app installs to a mobile home screen and passes a PWA audit.
- [ ] At least one table ships with RLS policies and a passing pgTAP test proving cross-group reads are denied.
- [ ] The `service_role` RPC whitelist convention is written and reviewable.
- [ ] Photo upload path demonstrates client-side compression and direct Storage serving (no `next/image` on gallery assets).
- [ ] `strict_tdd` re-evaluated and recorded once the test runner is installed.

## Next

`sdd-spec` and `sdd-design` (can run in parallel), then `sdd-tasks`.
