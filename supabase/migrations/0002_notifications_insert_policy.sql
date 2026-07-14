-- notifications currently has no INSERT policy, so client-side inserts
-- (e.g. "new lead" alerts to both admins) fail with 42501. Both admins
-- share the full lead pool, so any authenticated user may insert a
-- notification row for either admin.
create policy "authenticated users can insert notifications"
on notifications
for insert
to authenticated
with check (true);
