-- 022_photos_cloudinary.sql
-- Switches the gallery module from Supabase Storage to Cloudinary.
-- 016_photos.sql is already applied to Prod and is never edited (see
-- CLAUDE.md) -- this migration alters what it created instead.
--
-- Why: Cloudinary does its own server-side compression and derivative
-- generation (resize/format/quality by URL transformation), so the
-- client no longer needs to produce and store separate full/thumb
-- blobs -- one Cloudinary asset serves both via a URL parameter. The
-- storage_path/thumb_path columns were shaped for Supabase Storage's
-- path convention (photos/{group_id}/{event_id}/{photo_id}_{full|thumb}.webp)
-- and no longer apply.
--
-- Privacy model: Cloudinary has no RLS. The tenant boundary from RLS on
-- the `photos` table itself is preserved (SELECT/INSERT/DELETE policies
-- are untouched by this migration), but the actual image bytes now live
-- outside Postgres. The app MUST NOT use unsigned/public delivery URLs.
-- Uploads go through a signed request generated server-side (never
-- exposing the Cloudinary API secret to the client); assets are stored
-- with `type: authenticated` and served only via short-lived signed
-- delivery URLs, generated only after is_group_member(group_id) passes
-- -- i.e. only after RLS already proved membership on the `photos` row.
-- A public_id alone must never be treated as sufficient authorization.

alter table public.photos
  drop column storage_path,
  drop column thumb_path,
  add column cloudinary_public_id text not null,
  add column cloudinary_version   text;

alter table public.photos
  add constraint photos_cloudinary_public_id_key unique (cloudinary_public_id);

comment on column public.photos.cloudinary_public_id is
  'Cloudinary asset public_id. Never construct a delivery URL from this '
  'directly on the client -- always go through the signed-URL endpoint, '
  'which re-checks group membership before signing.';
comment on column public.photos.cloudinary_version is
  'Optional Cloudinary asset version, used to bust CDN cache after a '
  'reupload under the same public_id (not used in the MVP, where photos '
  'are immutable once uploaded -- kept for forward compatibility).';
