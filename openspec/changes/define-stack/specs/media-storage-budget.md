# Media & Storage Budget Specification

## Purpose

Encodes the cost-critical rules for photo handling (PRD US-08, US-11/CU-11): client-side compression, the 10 MB per-photo cap, per-group storage quotas, and direct-from-Storage serving without `next/image`. Supabase Storage's 1 GB free tier is the binding cost risk (proposal C3) and these rules are in MVP scope, not deferrable polish.

## Requirements

### Requirement: Client-Side Compression Before Upload

The system MUST compress images in the browser before upload begins, for every image destined for the event gallery.

#### Scenario: Large photo is compressed pre-upload

- GIVEN a user selects a JPEG/PNG/WebP photo larger than a few MB
- WHEN they initiate the upload
- THEN the bytes transmitted to Storage are the compressed output, not the original file

#### Scenario: Compression failure is visible, not silent

- GIVEN client-side compression fails for a given file (unsupported format, corrupted data)
- WHEN the user attempts to upload it
- THEN the user sees a clear error and the upload does not proceed with an uncompressed or partial file

### Requirement: 10 MB Per-Photo Cap

The system MUST reject any photo upload exceeding 10 MB after client-side compression, at both the client and the server/storage-policy layer.

#### Scenario: Oversized file rejected client-side

- GIVEN a compressed photo still exceeds 10 MB
- WHEN the user attempts to upload it
- THEN the upload is blocked before any network request, with a message stating the limit

#### Scenario: Oversized file rejected even if the client is bypassed

- GIVEN a request that bypasses the client-side check (e.g., a direct API call)
- WHEN a photo over 10 MB is submitted
- THEN the storage-layer policy rejects it — the 10 MB cap MUST NOT depend solely on client-side enforcement

### Requirement: Per-Group Storage Quota

The system MUST track cumulative storage consumption per group and MUST prevent new uploads once a group's quota is reached, with the remaining/used amount visible to members.

#### Scenario: Group under quota

- GIVEN a group with storage usage below its quota
- WHEN a member uploads a valid photo
- THEN the upload succeeds and the group's tracked usage increases accordingly

#### Scenario: Group at quota

- GIVEN a group whose storage usage has reached its quota
- WHEN a member attempts to upload another photo
- THEN the upload is rejected with a message explaining the group has reached its storage limit

### Requirement: Direct-from-Storage Serving Without `next/image`

Gallery photos MUST be served directly from Supabase Storage (public or signed URLs) and MUST NOT be routed through Next.js's built-in image optimization/transformation pipeline.

#### Scenario: Gallery image request bypasses image optimization

- GIVEN a rendered gallery of event photos
- WHEN a reviewer inspects the network requests for photo assets
- THEN each request resolves directly against Supabase Storage, with no request to the Next.js image-optimization endpoint

#### Scenario: Thumbnail derivative exists at upload time

- GIVEN a photo has finished uploading
- WHEN the gallery grid renders
- THEN it displays a smaller thumbnail derivative generated at upload time, not the full-size image scaled down at render time
