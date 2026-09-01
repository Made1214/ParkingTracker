-- 023_drop_supabase_storage_policies.sql
-- Reverts 020_storage_policies.sql. The gallery module moved to
-- Cloudinary (022_photos_cloudinary.sql); the `photos` Supabase Storage
-- bucket and its RLS policies are dead weight. 020 is never edited
-- (already applied to Prod) -- this migration explicitly undoes it
-- instead, same rule as any other applied migration.

drop policy if exists photos_bucket_select on storage.objects;
drop policy if exists photos_bucket_insert on storage.objects;
drop policy if exists photos_bucket_delete on storage.objects;

-- Supabase blocks `delete from storage.buckets` via direct SQL
-- (storage.protect_delete() guardrail, to prevent orphaning uploaded
-- objects). No object was ever uploaded to this bucket, so there is
-- nothing to orphan -- but the bucket row itself must be removed
-- through the Dashboard (Storage -> photos -> Delete bucket) or the
-- Storage API, not this migration.
