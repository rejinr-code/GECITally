-- Panels as first-class config, plus votes polled per post.
-- Run after 0001_init.sql in the Supabase SQL editor.

create table if not exists public.panels (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references public.elections (id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  unique (election_id, name)
);

alter table public.posts
  add column if not exists votes_polled integer;

update public.posts p
   set votes_polled = e.total_votes_polled
  from public.elections e
 where p.election_id = e.id
   and p.votes_polled is null;

alter table public.posts
  alter column votes_polled set default 0;

update public.posts set votes_polled = 0 where votes_polled is null;

alter table public.posts
  alter column votes_polled set not null;

do $$
begin
  alter table public.posts
    add constraint posts_votes_polled_nonnegative check (votes_polled >= 0);
exception
  when duplicate_object then null;
end $$;

alter table public.candidates
  add column if not exists panel_id uuid references public.panels (id) on delete set null;

create index if not exists idx_panels_election on public.panels (election_id, display_order);
create index if not exists idx_candidates_panel on public.candidates (panel_id);

insert into public.panels (election_id, name, display_order)
select sub.election_id, sub.panel_name, sub.rn
from (
  select
    p.election_id,
    c.panel_name,
    row_number() over (
      partition by p.election_id
      order by min(c.display_order), c.panel_name
    ) as rn
  from public.candidates c
  join public.posts p on p.id = c.post_id
  where c.panel_name is not null
    and btrim(c.panel_name) <> ''
    and lower(c.panel_name) <> 'independent'
  group by p.election_id, c.panel_name
) sub
on conflict (election_id, name) do nothing;

update public.candidates c
   set panel_id = pn.id
  from public.posts p
  join public.panels pn on pn.election_id = p.election_id
 where c.post_id = p.id
   and c.panel_id is null
   and c.panel_name is not null
   and pn.name = c.panel_name;

create or replace function public.sync_candidate_panel_name()
returns trigger
language plpgsql
as $$
begin
  if new.panel_id is not null then
    select name into new.panel_name
    from public.panels
    where id = new.panel_id;
  elsif tg_op = 'UPDATE' then
    new.panel_name := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_candidate_panel_name on public.candidates;
create trigger trg_sync_candidate_panel_name
  before insert or update of panel_id on public.candidates
  for each row execute function public.sync_candidate_panel_name();

create or replace function public.sync_panel_name_to_candidates()
returns trigger
language plpgsql
as $$
begin
  update public.candidates
     set panel_name = new.name
   where panel_id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_sync_panel_name_to_candidates on public.panels;
create trigger trg_sync_panel_name_to_candidates
  after update of name on public.panels
  for each row execute function public.sync_panel_name_to_candidates();

create or replace function public.get_live_results()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_election public.elections%rowtype;
  v_posts jsonb;
begin
  select *
    into v_election
  from public.elections
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('election', null, 'posts', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(post_row order by display_order, name), '[]'::jsonb)
    into v_posts
  from (
    select
      p.display_order,
      p.name,
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'seats', p.seats,
        'votes_polled', p.votes_polled,
        'display_order', p.display_order,
        'verified_rounds', (
          select count(*)::int
          from public.count_rounds cr
          where cr.post_id = p.id and cr.status = 'verified'
        ),
        'pending_rounds', (
          select count(*)::int
          from public.count_rounds cr
          where cr.post_id = p.id and cr.status = 'pending_verification'
        ),
        'is_finalised', (
          select count(*) >= v_election.count_limit
          from public.count_rounds cr
          where cr.post_id = p.id and cr.status = 'verified'
        ),
        'total_verified_votes', (
          select coalesce(sum(ce.votes), 0)::int
          from public.count_entries ce
          join public.count_rounds cr on cr.id = ce.round_id
          where cr.post_id = p.id and cr.status = 'verified'
        ),
        'candidates', (
          select coalesce(jsonb_agg(to_jsonb(c) order by c.votes desc, c.name), '[]'::jsonb)
          from (
            select
              cand.id,
              cand.name,
              cand.photo_url,
              coalesce(pn.name, cand.panel_name) as panel_name,
              coalesce((
                select sum(ce.votes)::int
                from public.count_entries ce
                join public.count_rounds cr on cr.id = ce.round_id
                where ce.candidate_id = cand.id
                  and cr.status = 'verified'
              ), 0) as votes
            from public.candidates cand
            left join public.panels pn on pn.id = cand.panel_id
            where cand.post_id = p.id
          ) c
        )
      ) as post_row
    from public.posts p
    where p.election_id = v_election.id
  ) s;

  return jsonb_build_object(
    'election', jsonb_build_object(
      'id', v_election.id,
      'name', v_election.name,
      'date', v_election.date,
      'total_votes_polled', v_election.total_votes_polled,
      'count_limit', v_election.count_limit,
      'state', v_election.state
    ),
    'posts', v_posts
  );
end;
$$;

alter table public.panels enable row level security;

drop policy if exists "panels_public_read" on public.panels;
create policy "panels_public_read" on public.panels
  for select using (true);

drop policy if exists "panels_admin_write" on public.panels;
create policy "panels_admin_write" on public.panels
  for all using (public.is_admin())
  with check (public.is_admin());

grant select on public.panels to anon, authenticated;
grant insert, update, delete on public.panels to authenticated;

alter table public.posts replica identity full;
alter table public.candidates replica identity full;
alter table public.panels replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.posts;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.candidates;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.panels;
  exception when duplicate_object then
    null;
  end;
end $$;
