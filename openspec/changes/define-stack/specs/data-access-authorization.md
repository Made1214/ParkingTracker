# Data Access & Authorization Specification

## Purpose

Establishes Row Level Security (RLS) as the sole authorization authority and defines the convention for atomic multi-table operations via Postgres RPC / `SECURITY DEFINER` functions. No requirement here permits application code to be the place authorization is decided. (Binding constraints C1, C4 in proposal; PRD 10.1 top security risk.)

## Requirements

### Requirement: RLS Is the Sole Authorization Authority

Every table holding group-scoped or user-scoped data MUST have RLS enabled with explicit policies before it is queryable. No requirement, code path, or convention in this system MAY treat application-layer checks (middleware, route guards, component conditionals) as a substitute for a database policy.

#### Scenario: New table ships without a policy

- GIVEN a developer creates a new group-scoped table
- WHEN the migration is reviewed
- THEN the review MUST reject it if RLS is not enabled and no policy exists — regardless of any application-layer check present

#### Scenario: Cross-group read is denied at the database

- GIVEN two groups A and B with private data
- WHEN a user authenticated as a member of group A queries group B's data directly against Postgres (bypassing application code)
- THEN the query returns zero rows, not an error revealing existence, and not the data

#### Scenario: UI hides an action the database also blocks

- GIVEN a non-admin member viewing an admin-only delete action
- WHEN the UI hides the delete button (UX sugar) AND the user issues the underlying request directly
- THEN the request is rejected by an RLS policy, not merely absent from the UI

### Requirement: User-Scoped Client by Default

All client-side and server-side request handling MUST use a Supabase client scoped to the authenticated user's session. The `service_role` key MUST NOT be shipped to any client bundle and MUST NOT be used for blanket/unscoped reads.

#### Scenario: Client bundle inspection

- GIVEN a production build of the application
- WHEN a reviewer inspects the shipped client bundle
- THEN no `service_role` key or equivalent privileged credential is present

#### Scenario: Privileged operation attempted from the client

- GIVEN a feature needs data that would require bypassing RLS
- WHEN a developer implements it
- THEN the implementation MUST go through a named, whitelisted RPC (see below), not a direct `service_role` query

### Requirement: Multi-Table Atomic Operations via RPC / SECURITY DEFINER

Any operation that must update or read across multiple tables atomically and re-check authorization as part of that atomicity (vote tallying, expense balance computation, invite-code group join) MUST be implemented as a Postgres RPC function. Functions requiring elevated privilege MUST be `SECURITY DEFINER` and MUST validate the caller's authorization inside the function body before acting.

#### Scenario: Invite-code join is atomic

- GIVEN a user submits a valid invite code
- WHEN the join RPC executes
- THEN group membership is created and any related counters/rows are updated in a single transaction, or none of them are

#### Scenario: Invalid invite code

- GIVEN a user submits an invite code that does not match any group
- WHEN the join RPC executes
- THEN no membership row is created and the caller receives a rejection, not a partial join

#### Scenario: RPC function is discoverable and reviewable

- GIVEN the set of `SECURITY DEFINER` functions in the schema
- WHEN a developer checks the written whitelist
- THEN every `SECURITY DEFINER` function is listed by name with its purpose, and no undocumented privileged function exists

### Requirement: RLS Policy Coverage Testable in CI

The system MUST provide at least one automated test proving that a cross-group read is denied by policy, runnable in CI without manual setup.

#### Scenario: CI catches a missing policy

- GIVEN a developer disables or removes RLS on a previously covered table
- WHEN CI runs the RLS policy test suite
- THEN the build fails
