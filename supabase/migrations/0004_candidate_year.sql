-- Switch candidate class from semester (S1–S8) to academic year (1–4).
-- Maps existing semester values: 1–2 → 1st, 3–4 → 2nd, 5–6 → 3rd, 7–8 → 4th.

alter table public.candidates
  add column if not exists year integer;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidates'
      and column_name = 'semester'
  ) then
    update public.candidates
    set year = ceil(semester::numeric / 2)::integer
    where year is null
      and semester is not null
      and semester between 1 and 8;
  end if;
end $$;

alter table public.candidates
  drop constraint if exists candidates_year_check;

alter table public.candidates
  add constraint candidates_year_check
  check (year is null or (year >= 1 and year <= 4));

alter table public.candidates
  drop constraint if exists candidates_semester_check;

alter table public.candidates
  drop column if exists semester;

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
              cand.branch,
              cand.year,
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
