-- Live results display: post rotate delay, and whether public totals wait for supervisor verification.

alter table public.elections
  add column if not exists results_rotate_seconds integer not null default 12;

alter table public.elections
  add column if not exists results_require_verification boolean not null default true;

alter table public.elections
  drop constraint if exists elections_results_rotate_seconds_check;

alter table public.elections
  add constraint elections_results_rotate_seconds_check
  check (results_rotate_seconds >= 5 and results_rotate_seconds <= 120);

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
  v_require_verification boolean;
  v_rotate_seconds integer;
begin
  select *
    into v_election
  from public.elections
  order by created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('election', null, 'posts', '[]'::jsonb);
  end if;

  v_require_verification := coalesce(v_election.results_require_verification, true);
  v_rotate_seconds := coalesce(v_election.results_rotate_seconds, 12);

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
          where cr.post_id = p.id
            and (
              cr.status = 'verified'
              or (not v_require_verification and cr.status = 'pending_verification')
            )
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
                  and (
                    cr.status = 'verified'
                    or (not v_require_verification and cr.status = 'pending_verification')
                  )
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
      'state', v_election.state,
      'results_rotate_seconds', v_rotate_seconds,
      'results_require_verification', v_require_verification
    ),
    'posts', v_posts
  );
end;
$$;

grant execute on function public.get_live_results() to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'elections'
  ) then
    alter publication supabase_realtime add table public.elections;
  end if;
end $$;
