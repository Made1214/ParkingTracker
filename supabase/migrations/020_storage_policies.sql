-- 021_storage_policies.sql
-- Private bucket. Path convention: photos/{group_id}/{event_id}/{photo_id}_{full|thumb}.webp
-- Storage RLS keys off the FIRST path segment via the same
-- is_group_member() helper used by every table policy, so the rule is
-- reviewable as the same shape everywhere.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

create policy photos_bucket_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (select private.is_group_member((storage.foldername(name))[1]::uuid))
  );

create policy photos_bucket_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (select private.is_group_member((storage.foldername(name))[1]::uuid))
  );

create policy photos_bucket_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner = (select auth.uid())
      or (select private.is_group_admin((storage.foldername(name))[1]::uuid))
    )
  );
