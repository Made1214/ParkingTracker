# Testing Foundation Specification

## Purpose

Establishes the test runner and testing approach — including a dedicated RLS policy test category — that all 13 modules build on. This spec covers the foundation only; module-specific test cases belong to later changes.

## Requirements

### Requirement: Unit and Component Test Runner Available

The system MUST provide a working unit/component test runner, runnable both locally and in CI, with at least one passing example test proving the setup works end-to-end.

#### Scenario: Example test runs in CI

- GIVEN the scaffold's test command
- WHEN CI executes it
- THEN at least one unit/component test runs and passes, proving the runner, config, and CI wiring are all functional

### Requirement: End-to-End Test Runner Available

The system MUST provide a working end-to-end browser test runner, runnable in CI against a built instance of the app, with at least one passing example test.

#### Scenario: Example E2E test runs in CI

- GIVEN the scaffold's E2E command
- WHEN CI executes it against a built app
- THEN at least one E2E test runs and passes

### Requirement: Dedicated RLS Policy Test Category

The system MUST provide a database-level test category dedicated to RLS policies, separate from application unit tests, capable of proving that a policy denies unauthorized access without going through application code.

#### Scenario: RLS test denies cross-group access

- GIVEN a table with an RLS policy scoping rows to group membership
- WHEN the RLS test suite runs a query as a user outside that group
- THEN the test asserts zero rows returned and the suite reports this as a pass

#### Scenario: RLS test category runs in CI independently

- GIVEN the CI pipeline
- WHEN it executes
- THEN the RLS policy test job runs as its own job/step, distinguishable in CI output from unit and E2E jobs

### Requirement: CI Test Gate on Merge

The system MUST run lint, typecheck, unit, E2E, and RLS policy test jobs on every pull request, and MUST block merge if any job fails.

#### Scenario: Failing RLS test blocks merge

- GIVEN a pull request that weakens or removes an RLS policy
- WHEN the RLS policy test job fails in CI
- THEN the pull request is blocked from merging by CI status, not by reviewer memory alone

### Requirement: Strict TDD Mode Re-Evaluation Recorded

The system MUST record, once the test runners above are installed and passing in CI, an explicit decision on whether strict TDD mode is enabled for subsequent feature work.

#### Scenario: Decision is written down

- GIVEN the test runners are installed and CI is green
- WHEN a developer looks for the strict-TDD decision
- THEN a recorded decision (enabled or not, with reasoning) exists — it is not left as an unstated default
