# PWA Delivery Specification

## Purpose

Defines the installable PWA foundation: manifest, service worker, offline shell behavior, and a deliberate install-prompt flow. Anchored to PRD US-02 (invite by link) and US-04 (1-click RSVP) — installation must never interrupt those flows — and to the post-MVP Web Push dependency (PRD section 8), which on iOS 16.4+ requires home-screen install first.

## Requirements

### Requirement: Installable Web App Manifest

The system MUST ship a valid web app manifest (name, icons at required sizes, start URL, display mode) so the app qualifies as installable per standard PWA audit criteria.

#### Scenario: PWA audit passes

- GIVEN the deployed application
- WHEN an automated PWA installability audit runs
- THEN it reports the app as installable with no manifest errors

### Requirement: Service Worker Registration and Offline Shell

The system MUST register a service worker that caches the application shell so previously visited screens remain reachable (in a degraded, clearly-marked offline state) without a network connection.

#### Scenario: Offline reload of a visited screen

- GIVEN a user has previously loaded a screen while online
- WHEN they lose network connectivity and reload that screen
- THEN the app shell renders (not a browser offline error page), and the user sees a clear indicator that data may be stale

#### Scenario: Offline attempt at a data mutation

- GIVEN a user is offline
- WHEN they attempt an action that requires a network write (e.g., RSVP, vote, expense entry)
- THEN the app communicates the action cannot complete offline, rather than silently failing or losing the input

### Requirement: Deliberate Home-Screen Install Prompt Flow

The system MUST present an explicit, dismissible install-to-home-screen prompt at a point in the user journey that does NOT block or delay invite-link acceptance (US-02) or 1-click RSVP (US-04). The prompt MUST be re-offerable (not a permanent one-time dismissal that blocks reconsideration).

#### Scenario: Invite link opens without a forced install gate

- GIVEN a new user opens an invite link
- WHEN the invite/join screen loads
- THEN they can accept the invite and complete RSVP without being forced to install first

#### Scenario: Install prompt appears at an appropriate moment

- GIVEN a user has joined a group and viewed at least one event
- WHEN the app determines the user is engaged (per a documented trigger condition)
- THEN an install-to-home-screen prompt is offered, dismissible, and not shown on every page load

#### Scenario: iOS install path is explained

- GIVEN a user on iOS Safari (no native install banner API)
- WHEN the install prompt is shown
- THEN the app displays iOS-specific manual "Add to Home Screen" instructions, since iOS provides no programmatic install trigger

### Requirement: Foundation for Future Web Push

The system MUST verify, as part of this change, that the installed (home-screen) PWA on iOS 16.4+ meets the platform's prerequisite for Web Push, even though push delivery itself is out of scope.

#### Scenario: Installed-state check exists

- GIVEN the app is added to the home screen on an iOS 16.4+ device
- WHEN a developer checks the documented verification steps
- THEN the steps confirm the installed context meets the platform's Web Push eligibility prerequisite, with no push notification implemented
