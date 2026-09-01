# Media & Storage Budget Specification

## Purpose

Encodes the cost-critical and privacy-critical rules for photo handling (PRD US-08, US-11/CU-11): the 10 MB per-photo cap, per-group storage quotas, and authorized delivery without `next/image`.

**Amendment:** photo storage moved from Supabase Storage to **Cloudinary** after this change was first approved (see `design.md` §7 for the full rationale). Client-side compression and hand-produced thumbnail derivatives are no longer required — Cloudinary generates derivatives server-side via URL transformation. What is unchanged: the 10 MB cap, per-group quotas, and the ban on `next/image` for gallery assets (now for a narrower reason — see the corresponding requirement below). What is *new*: because Cloudinary has no Row Level Security, this spec now states explicitly that a signed delivery URL MUST NOT be issued without an authorization check, where issuing that URL without one used to be structurally impossible under Supabase Storage's RLS-backed signing.

## Requirements

### Requirement: Server-Signed Upload

The system MUST generate photo upload credentials on the server, using a secret never exposed to the client, for every image destined for the event gallery. The client MUST NOT hold or transmit the storage provider's API secret.

#### Scenario: Upload is signed server-side

- GIVEN a user selects a photo to upload to an event gallery
- WHEN the client requests to upload it
- THEN the server generates the signed upload parameters and the client uses them to upload directly to the storage provider — the client never receives the API secret itself

#### Scenario: Client cannot upload without a valid signature

- GIVEN a request to the storage provider's upload endpoint that lacks a valid, freshly-issued signature
- WHEN the storage provider receives it
- THEN the upload is rejected by the provider, independent of any application-layer check

### Requirement: 10 MB Per-Photo Cap

The system MUST reject any photo upload exceeding 10 MB, at both the client and a layer the client cannot bypass.

#### Scenario: Oversized file rejected client-side

- GIVEN a photo larger than 10 MB
- WHEN the user attempts to upload it
- THEN the upload is blocked before any network request, with a message stating the limit

#### Scenario: Oversized file rejected even if the client is bypassed

- GIVEN a request that bypasses the client-side check (e.g., a direct API call using a validly-signed upload request)
- WHEN a photo over 10 MB is submitted
- THEN the database row insert that finalizes the upload is rejected by a `CHECK` constraint on the `photos` table — the 10 MB cap MUST NOT depend solely on client-side enforcement

### Requirement: Per-Group Storage Quota

The system MUST track cumulative storage consumption per group and MUST prevent a photo from becoming servable once a group's quota is reached, with the remaining/used amount visible to members.

#### Scenario: Group under quota

- GIVEN a group with storage usage below its quota
- WHEN a member uploads a valid photo
- THEN the upload succeeds, the `photos` row is created, and the group's tracked usage increases accordingly

#### Scenario: Group at quota

- GIVEN a group whose storage usage has reached its quota
- WHEN a member attempts to upload another photo
- THEN the database row insert is rejected with a message explaining the group has reached its storage limit — an upload that reaches the storage provider but fails this check MUST NOT leave the photo servable through the app (its `photos` row does not exist, so no RLS policy or signed-URL path can ever return it)

### Requirement: Authorized Delivery Only — No Unsigned or Client-Constructed URLs

Because the media storage provider has no Row Level Security of its own, the system MUST NOT let a client construct or receive a photo delivery URL without a server-side authorization check equivalent to the `photos` table's RLS policy (group membership). A `public_id` or asset identifier alone MUST NOT be treated as sufficient to grant access.

#### Scenario: Delivery URL requires a fresh membership check

- GIVEN a member of group A requests to view a photo belonging to group A
- WHEN the client asks the server for a delivery URL
- THEN the server verifies group membership (the same check the `photos` table's RLS policy applies) before signing and returning a short-lived delivery URL

#### Scenario: Non-member cannot obtain a delivery URL

- GIVEN a user who is not a member of the group a photo belongs to
- WHEN they request a delivery URL for that photo, including by guessing or reusing a `public_id`
- THEN the server refuses to sign a URL for it, independent of whether the client already knows the asset identifier

#### Scenario: A leaked delivery URL has a short lifetime

- GIVEN a signed delivery URL is captured or shared outside the app
- WHEN its expiry window (short-lived, minutes not days) elapses
- THEN the URL no longer resolves to the image, limiting the exposure window of an accidental leak

### Requirement: Direct-from-Provider Serving Without `next/image`

Gallery photos MUST be served directly from the media storage provider via signed delivery URLs and MUST NOT be routed through Next.js's built-in image optimization/transformation pipeline.

#### Scenario: Gallery image request bypasses image optimization

- GIVEN a rendered gallery of event photos
- WHEN a reviewer inspects the network requests for photo assets
- THEN each request resolves directly against the media storage provider's delivery domain, with no request to the Next.js image-optimization endpoint

#### Scenario: Grid renders a smaller derivative than the lightbox

- GIVEN a photo has finished uploading
- WHEN the gallery grid renders
- THEN it requests a smaller derivative (via a delivery-time transformation, not a separately stored file) than the one requested when the lightbox opens the same photo full-size
