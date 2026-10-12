-- Forward each counted round to the hall. New rounds stay off the live board until forwarded again.

alter table public.posts
  add column if not exists display_released boolean not null default false,
  add column if not exists display_released_at timestamptz,
  add column if not exists display_released_by uuid,
  add column if not exists display_released_rounds integer not null default 0;

comment on column public.posts.display_released_rounds is
  'How many counted rounds were last forwarded to the public hall live board.';

update public.posts p
   set display_released_rounds = (
     select count(*)::int
     from public.count_rounds cr
     join public.elections e on e.id = p.election_id
     where cr.post_id = p.id
       and (
         cr.status = 'verified'
         or (
           not coalesce(e.results_require_verification, true)
           and cr.status = 'pending_verification'
         )
       )
   )
 where p.display_released = true
   and coalesce(p.display_released_rounds, 0) = 0;

create or replace function public.reset_election_counts(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reset counts';
  end if;

  perform set_config('geci.allow_count_reset', 'true', true);

  delete from public.count_rounds cr
  using public.posts p
  where cr.post_id = p.id
    and p.election_id = p_election_id;

  update public.posts
     set display_released = false,
         display_released_at = null,
         display_released_by = null,
         display_released_rounds = 0
   where election_id = p_election_id;

  update public.elections
     set state = 'setup'
   where id = p_election_id;
end;
$$;

create or replace function public.set_post_display_release(
  p_post_id uuid,
  p_release boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(public.current_role()::text, '');
  v_election public.elections%rowtype;
  v_seats integer;
  v_require_verification boolean;
  v_marks integer;
  v_rounds integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_role not in ('admin', 'supervisor') then
    raise exception 'Only an admin or Returning Officer can control the hall display';
  end if;

  select e.*
    into v_election
  from public.elections e
  join public.posts p on p.election_id = e.id
  where p.id = p_post_id;

  if not found then
    raise exception 'Post not found';
  end if;

  if v_election.state not in ('counting', 'finalised') then
    raise exception 'Counting is not open for this election';
  end if;

  if p_release then
    v_require_verification := coalesce(v_election.results_require_verification, true);
    select greatest(coalesce(p.seats, 1), 1) into v_seats from public.posts p where p.id = p_post_id;

    select count(*)::int
      into v_rounds
    from public.count_rounds cr
    where cr.post_id = p_post_id
      and (
        cr.status = 'verified'
        or (not v_require_verification and cr.status = 'pending_verification')
      );

    select
      coalesce((
        select sum(ce.votes)
        from public.count_entries ce
        join public.count_rounds cr on cr.id = ce.round_id
        where cr.post_id = p_post_id
          and (
            cr.status = 'verified'
            or (not v_require_verification and cr.status = 'pending_verification')
          )
      ), 0)
      + coalesce((
        select sum(cr.invalid_votes)
        from public.count_rounds cr
        where cr.post_id = p_post_id
          and (
            cr.status = 'verified'
            or (not v_require_verification and cr.status = 'pending_verification')
          )
      ), 0)
      into v_marks;

    if v_rounds <= 0 or v_marks <= 0 then
      raise exception 'Count this post first, then forward the result to the hall';
    end if;

    update public.posts
       set display_released = true,
           display_released_at = now(),
           display_released_by = auth.uid(),
           display_released_rounds = v_rounds
     where id = p_post_id;
  else
    update public.posts
       set display_released = false,
           display_released_at = null,
           display_released_by = null,
           display_released_rounds = 0
     where id = p_post_id;
  end if;

  return jsonb_build_object('ok', true, 'released', p_release, 'rounds', coalesce(v_rounds, 0));
end;
$$;

grant execute on function public.set_post_display_release(uuid, boolean) to authenticated;
revoke execute on function public.set_post_display_release(uuid, boolean) from public, anon;

drop function if exists public.get_live_results();

create or replace function public.get_live_results(p_control boolean default false)
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
  v_preview boolean;
begin
  if auth.uid() is null
     or coalesce(public.current_role()::text, '') not in ('admin', 'staff', 'supervisor', 'display') then
    raise exception 'Not allowed to view live results';
  end if;

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
  v_preview :=
    coalesce(p_control, false)
    and coalesce(public.current_role()::text, '') in ('admin', 'supervisor');

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
        'display_released', coalesce(p.display_released, false),
        'display_released_rounds', coalesce(p.display_released_rounds, 0),
        'verified_rounds', case when vis.show_counts then (
          select count(*)::int
          from public.count_rounds cr
          where cr.id = any(rnd.ids) and cr.status = 'verified'
        ) else 0 end,
        'pending_rounds', case when vis.show_counts then (
          select count(*)::int
          from public.count_rounds cr
          where cr.id = any(rnd.ids) and cr.status = 'pending_verification'
        ) else 0 end,
        'is_finalised', case when vis.show_counts then (
          p.votes_polled > 0
          and (
            coalesce((
              select sum(ce.votes)
              from public.count_entries ce
              join public.count_rounds cr on cr.id = ce.round_id
              where cr.id = any(rnd.ids)
                and cr.status = 'verified'
            ), 0)
            + coalesce((
              select sum(cr.invalid_votes)
              from public.count_rounds cr
              where cr.id = any(rnd.ids)
                and cr.status = 'verified'
            ), 0)
          ) >= p.votes_polled * greatest(coalesce(p.seats, 1), 1)
        ) else false end,
        'total_verified_votes', case when vis.show_counts then (
          select coalesce(sum(ce.votes), 0)::int
          from public.count_entries ce
          join public.count_rounds cr on cr.id = ce.round_id
          where cr.id = any(rnd.ids)
        ) else 0 end,
        'invalid_votes', case when vis.show_counts then (
          select coalesce(sum(cr.invalid_votes), 0)::int
          from public.count_rounds cr
          where cr.id = any(rnd.ids)
        ) else 0 end,
        'invalid_slot_votes', (
          select coalesce(jsonb_agg(slot.total order by slot.ord), '[]'::jsonb)
          from (
            select
              gs.ord,
              case when vis.show_counts then coalesce((
                select sum(
                  case
                    when coalesce(array_length(cr.invalid_slot_votes, 1), 0) >= gs.ord
                      then cr.invalid_slot_votes[gs.ord]
                    when gs.ord = 1 then cr.invalid_votes
                    else 0
                  end
                )
                from public.count_rounds cr
                where cr.id = any(rnd.ids)
              ), 0)::int else 0 end as total
            from generate_series(1, greatest(coalesce(p.seats, 1), 1)) gs(ord)
          ) slot
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
              pn.color as panel_color,
              case when vis.show_counts then coalesce((
                select sum(ce.votes)::int
                from public.count_entries ce
                join public.count_rounds cr on cr.id = ce.round_id
                where ce.candidate_id = cand.id
                  and cr.id = any(rnd.ids)
              ), 0) else 0 end as votes,
              (
                select coalesce(jsonb_agg(slot.total order by slot.ord), '[]'::jsonb)
                from (
                  select
                    gs.ord,
                    case when vis.show_counts then coalesce((
                      select sum(
                        case
                          when coalesce(array_length(ce.slot_votes, 1), 0) >= gs.ord
                            then ce.slot_votes[gs.ord]
                          else 0
                        end
                      )
                      from public.count_entries ce
                      join public.count_rounds cr on cr.id = ce.round_id
                      where ce.candidate_id = cand.id
                        and cr.id = any(rnd.ids)
                    ), 0)::int else 0 end as total
                  from generate_series(1, greatest(coalesce(p.seats, 1), 1)) gs(ord)
                ) slot
              ) as slot_votes
            from public.candidates cand
            left join public.panels pn on pn.id = cand.panel_id
            where cand.post_id = p.id
          ) c
        )
      ) as post_row
    from public.posts p
    cross join lateral (
      select
        (coalesce(p.display_released, false) or v_preview) as show_counts,
        case
          when v_preview then null
          else coalesce(p.display_released_rounds, 0)
        end as round_limit
    ) vis
    cross join lateral (
      select coalesce((
        select array_agg(r.id)
        from (
          select
            cr.id,
            row_number() over (
              order by coalesce(cr.submitted_at, cr.verified_at), cr.round_number, cr.id
            ) as ord
          from public.count_rounds cr
          where cr.post_id = p.id
            and (
              cr.status = 'verified'
              or (not v_require_verification and cr.status = 'pending_verification')
            )
        ) r
        where vis.round_limit is null or r.ord <= vis.round_limit
      ), '{}'::uuid[]) as ids
    ) rnd
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
      'poll_announced', coalesce(v_election.poll_announced, false),
      'results_rotate_seconds', v_rotate_seconds,
      'results_require_verification', v_require_verification
    ),
    'posts', v_posts
  );
end;
$$;

revoke execute on function public.get_live_results(boolean) from anon, public;
grant execute on function public.get_live_results(boolean) to authenticated;
