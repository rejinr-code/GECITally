-- Public hall view cannot subscribe to count_rounds after RLS tightened.
-- This one-row tick is safe to read and notifies TVs when counts change.

create table if not exists public.results_tick (
  id smallint primary key default 1 check (id = 1),
  updated_at timestamptz not null default now()
);

insert into public.results_tick (id, updated_at)
values (1, now())
on conflict (id) do update set updated_at = excluded.updated_at;

alter table public.results_tick enable row level security;

drop policy if exists "results_tick_public_read" on public.results_tick;
create policy "results_tick_public_read" on public.results_tick
  for select using (true);

grant select on public.results_tick to anon, authenticated;

create or replace function public.bump_results_tick()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.results_tick (id, updated_at)
  values (1, now())
  on conflict (id) do update set updated_at = now();
  return null;
end;
$$;

drop trigger if exists trg_tick_count_rounds on public.count_rounds;
create trigger trg_tick_count_rounds
  after insert or update or delete on public.count_rounds
  for each statement execute function public.bump_results_tick();

drop trigger if exists trg_tick_count_entries on public.count_entries;
create trigger trg_tick_count_entries
  after insert or update or delete on public.count_entries
  for each statement execute function public.bump_results_tick();

drop trigger if exists trg_tick_posts on public.posts;
create trigger trg_tick_posts
  after insert or update or delete on public.posts
  for each statement execute function public.bump_results_tick();

drop trigger if exists trg_tick_candidates on public.candidates;
create trigger trg_tick_candidates
  after insert or update or delete on public.candidates
  for each statement execute function public.bump_results_tick();

drop trigger if exists trg_tick_elections on public.elections;
create trigger trg_tick_elections
  after insert or update or delete on public.elections
  for each statement execute function public.bump_results_tick();

alter table public.results_tick replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'results_tick'
  ) then
    alter publication supabase_realtime add table public.results_tick;
  end if;
end $$;
