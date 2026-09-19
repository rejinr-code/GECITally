-- Counting writes must go through security-definer RPCs only.
-- Stop staff/supervisors from inserting or updating count rows directly,
-- and stop anonymous clients from reading verified round detail.

drop policy if exists "rounds_staff_insert" on public.count_rounds;
drop policy if exists "rounds_staff_update_rejected" on public.count_rounds;
drop policy if exists "rounds_supervisor_update" on public.count_rounds;
drop policy if exists "entries_staff_insert" on public.count_entries;
drop policy if exists "entries_staff_delete" on public.count_entries;

drop policy if exists "rounds_select" on public.count_rounds;
create policy "rounds_select" on public.count_rounds
  for select using (
    public.is_admin()
    or public.is_supervisor()
    or staff_id = auth.uid()
  );

drop policy if exists "entries_select" on public.count_entries;
create policy "entries_select" on public.count_entries
  for select using (
    public.is_admin()
    or public.is_supervisor()
    or exists (
      select 1
      from public.count_rounds cr
      where cr.id = round_id
        and cr.staff_id = auth.uid()
    )
  );

revoke execute on function public.maybe_finalise_post(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'staff'::public.user_role
  )
  on conflict (id) do update
    set full_name = excluded.full_name;
  return new;
end;
$$;
