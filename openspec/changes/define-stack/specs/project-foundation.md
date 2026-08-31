# Project Foundation Specification

## Purpose

Defines the repository scaffold, feature-sliced source layout, naming/placement conventions, and environment/config handling that all 13 MVP modules build on. This is structure, not feature behavior.

## Requirements

### Requirement: Working Scaffold

The system MUST provide a Next.js App Router project that installs, builds, and runs with a single package-manager command, with no manual post-clone fixes.

#### Scenario: Clean clone boots

- GIVEN a developer clones the repository fresh
- WHEN they run the install command followed by the dev command
- THEN the app starts locally without errors or undocumented manual steps

#### Scenario: CI build passes

- GIVEN the scaffold committed to the main branch
- WHEN CI runs lint, typecheck, and build
- THEN all three complete with zero errors

### Requirement: Feature-Sliced Module Structure

The system MUST organize application code under `src/features/{module}/`, with exactly one directory per MVP module, mapped 1:1 to the 12 modules in PRD section 7.1: auth, groups, events, rsvp, agenda, proposals, comments, expenses, tasks, gallery, history, statistics.

User profile management belongs to `auth`, not to a separate module: PRD section 7.1 scopes "Autenticación" as "Email/contraseña + Google OAuth, perfil básico", and US-01 creates the profile as part of registration.

Cross-cutting code (UI primitives, Supabase clients, shared hooks/types) MUST live under `src/shared/` and MUST NOT contain module-specific business logic.

#### Scenario: Module directory exists for every MVP module

- GIVEN the repository scaffold
- WHEN a reviewer lists `src/features/`
- THEN all 13 module directories are present and none are missing or merged

#### Scenario: Shared code has no feature logic

- GIVEN a code review of `src/shared/`
- WHEN a reviewer inspects its contents
- THEN it contains only cross-cutting primitives (UI, client setup, generic hooks/types) with no single-module business rule

### Requirement: Internal Slice Convention

Each `src/features/{module}/` directory MUST follow a consistent internal shape (e.g., components, hooks, api, types) so any developer can navigate any module without asking its owner.

#### Scenario: New module follows the convention

- GIVEN a developer scaffolds a new module directory
- WHEN they follow the documented convention
- THEN the subdirectory names match every other existing module's shape

### Requirement: Module Ownership

The system MUST document a named owner (or owning pair) for each of the 13 module directories, reviewable by all 8 developers.

#### Scenario: Ownership lookup

- GIVEN a developer wants to know who owns the `expenses` module
- WHEN they check the ownership document
- THEN exactly one owner (or pair) is listed with no ambiguity

### Requirement: Environment and Config Handling

The system MUST read all secrets (Supabase URL/keys, OAuth credentials) from environment variables, MUST NOT commit any secret value to the repository, and MUST fail fast with a clear error at startup if a required variable is missing.

#### Scenario: Missing required env var

- GIVEN a required environment variable is unset
- WHEN the app starts (dev or build)
- THEN startup fails with an error naming the missing variable, not a silent fallback or crash deep in a request handler

#### Scenario: Example env file present

- GIVEN a developer clones the repository
- WHEN they look for required configuration
- THEN an example env file lists every required variable with no real secret values
