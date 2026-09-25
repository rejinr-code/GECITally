-- Multi-seat posts: each ballot paper has `seats` marks (1st, 2nd, ...).
-- Single-seat counting is unchanged: one mark per ballot and one invalid total.
-- votes_polled stays the number of ballot papers. A post finalises when
-- counted marks reach votes_polled * seats.

alter table public.count_rounds
  add column if not exists invalid_slot_votes integer[] not null default '{}';

comment on column public.count_rounds.invalid_slot_votes is
  'Invalid marks per ballot slot (1st, 2nd, ...). Empty means a legacy round that only stored invalid_votes.';

create or replace function public.maybe_finalise_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_polled integer;
  v_seats integer;
  v_counted integer;
begin
  select p.votes_polled, greatest(coalesce(p.seats, 1), 1)
    into v_polled, v_seats
  from public.posts p
  where p.id = p_post_id;

  if not found or coalesce(v_polled, 0) <= 0 then
    return;
  end if;

  select
    coalesce((
      select sum(ce.votes)
      from public.count_entries ce
      join public.count_rounds cr on cr.id = ce.round_id
      where cr.post_id = p_post_id
        and cr.status = 'verified'
    ), 0)
    + coalesce((
      select sum(cr.invalid_votes)
      from public.count_rounds cr
      where cr.post_id = p_post_id
        and cr.status = 'verified'
    ), 0)
    into v_counted;

  if v_counted >= v_polled * v_seats then
    update public.count_rounds
       set is_finalised = true
     where post_id = p_post_id
       and status = 'verified'
       and is_finalised = false;
  end if;
end;
$$;

drop function if exists public.submit_count_round(uuid, jsonb);
drop function if exists public.submit_count_round(uuid, jsonb, integer);
drop function if exists public.submit_count_round(uuid, jsonb, integer, integer[]);

create function public.submit_count_round(
  p_post_id uuid,
  p_entries jsonb,
  p_invalid_votes integer default 0,
  p_invalid_slot_votes integer[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := auth.uid();
  v_election public.elections%rowtype;
  v_polled integer;
  v_seats integer;
  v_candidate_count integer;
  v_entry_count integer;
  v_pending integer;
  v_rejected_id uuid;
  v_round_number integer;
  v_round_id uuid;
  v_entry jsonb;
  v_require_review boolean;
  v_status public.round_status;
  v_invalid integer;
  v_slots integer[];
  v_round_marks integer;
  v_round_ballots integer;
  v_counted_marks integer;
  v_counted_ballots integer;
  v_remaining integer;
  v_slot integer;
begin
  if v_staff is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_staff() and not public.is_admin() then
    raise exception 'Only counting staff can submit rounds';
  end if;

  if public.is_staff() and not public.is_assigned_to_post(p_post_id) then
    raise exception 'You are not assigned to this post';
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Entries must be a JSON array';
  end if;

  select e.*
    into v_election
  from public.elections e
  join public.posts p on p.election_id = e.id
  where p.id = p_post_id;

  if not found then
    raise exception 'Post not found';
  end if;

  select p.votes_polled, greatest(coalesce(p.seats, 1), 1)
    into v_polled, v_seats
  from public.posts p
  where p.id = p_post_id;

  if p_invalid_slot_votes is not null then
    if coalesce(array_length(p_invalid_slot_votes, 1), 0) <> v_seats then
      raise exception 'Submit an invalid count for each of the % votes on a ballot', v_seats;
    end if;
    foreach v_slot in array p_invalid_slot_votes loop
      if v_slot is null or v_slot < 0 then
        raise exception 'Invalid votes must be 0 or more';
      end if;
    end loop;
    v_slots := p_invalid_slot_votes;
    v_invalid := 0;
    foreach v_slot in array v_slots loop
      v_invalid := v_invalid + v_slot;
    end loop;
    if coalesce(p_invalid_votes, v_invalid) <> v_invalid then
      raise exception 'Invalid totals do not match the 1st/2nd counts';
    end if;
  else
    v_invalid := coalesce(p_invalid_votes, 0);
    if v_invalid < 0 then
      raise exception 'Invalid votes must be 0 or more';
    end if;
    if v_seats > 1 then
      raise exception 'This post has % votes per ballot. Submit invalid counts for 1st and 2nd separately.', v_seats;
    end if;
    v_slots := array[v_invalid];
  end if;

  if v_election.state <> 'counting' then
    raise exception 'Counting is not open for this election';
  end if;

  v_require_review := coalesce(v_election.counting_require_verification, true)
    and coalesce(v_election.results_require_verification, true);
  v_status := case when v_require_review then 'pending_verification'::public.round_status else 'verified'::public.round_status end;

  perform 1 from public.elections where id = v_election.id for update;
  perform 1 from public.posts where id = p_post_id for update;

  if not v_require_review then
    update public.count_rounds
       set status = 'verified',
           verified_by = coalesce(verified_by, v_staff),
           verified_at = coalesce(verified_at, now())
     where post_id = p_post_id
       and status = 'pending_verification';
  end if;

  select count(*) into v_candidate_count
  from public.candidates
  where post_id = p_post_id;

  v_entry_count := jsonb_array_length(p_entries);

  if v_candidate_count = 0 then
    raise exception 'This post has no candidates';
  end if;

  if v_entry_count <> v_candidate_count then
    raise exception 'Submit a count for every candidate in a single transaction';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) e
    where not exists (
      select 1 from public.candidates c
      where c.id = (e->>'candidate_id')::uuid
        and c.post_id = p_post_id
    )
  ) then
    raise exception 'One or more candidates do not belong to this post';
  end if;

  if exists (
    select 1
    from public.candidates c
    where c.post_id = p_post_id
      and not exists (
        select 1
        from jsonb_array_elements(p_entries) e
        where (e->>'candidate_id')::uuid = c.id
      )
  ) then
    raise exception 'Missing candidate in this round';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_entries) e
    where (e->>'votes') is null
       or (e->>'votes') ~ '[^0-9]'
       or (e->>'votes')::int < 0
  ) then
    raise exception 'Votes must be integers greater than or equal to 0';
  end if;

  select coalesce(sum((e->>'votes')::int), 0) + v_invalid
    into v_round_marks
  from jsonb_array_elements(p_entries) e;

  if v_round_marks <= 0 then
    raise exception 'A round must contain at least one ballot';
  end if;

  if v_round_marks % v_seats <> 0 then
    raise exception 'Each ballot for this post must contain exactly % votes', v_seats;
  end if;

  v_round_ballots := v_round_marks / v_seats;

  if v_round_ballots > v_election.count_limit then
    raise exception 'A round cannot contain more than % ballots', v_election.count_limit;
  end if;

  select
    coalesce((
      select sum(ce.votes)
      from public.count_entries ce
      join public.count_rounds cr on cr.id = ce.round_id
      where cr.post_id = p_post_id
        and cr.status in ('verified', 'pending_verification')
    ), 0)
    + coalesce((
      select sum(cr.invalid_votes)
      from public.count_rounds cr
      where cr.post_id = p_post_id
        and cr.status in ('verified', 'pending_verification')
    ), 0)
    into v_counted_marks;

  v_counted_ballots := v_counted_marks / v_seats;

  if coalesce(v_polled, 0) > 0 then
    v_remaining := v_polled - v_counted_ballots;
    if v_remaining <= 0 then
      raise exception 'All ballots for this post have already been counted';
    end if;
    if v_remaining > v_election.count_limit then
      if v_round_ballots <> v_election.count_limit then
        raise exception 'This round must contain exactly % ballots. The last round may contain fewer.', v_election.count_limit;
      end if;
    elsif v_round_ballots <> v_remaining then
      raise exception 'This last round must contain the remaining % ballots', v_remaining;
    end if;
  end if;

  if v_require_review then
    select count(*) into v_pending
    from public.count_rounds
    where post_id = p_post_id
      and staff_id = v_staff
      and status = 'pending_verification';

    if v_pending > 0 then
      raise exception 'A round is already awaiting supervisor verification';
    end if;
  end if;

  select cr.id
    into v_rejected_id
  from public.count_rounds cr
  where cr.post_id = p_post_id
    and cr.staff_id = v_staff
    and cr.status = 'rejected'
  order by cr.round_number desc
  limit 1;

  if v_rejected_id is not null then
    select round_number into v_round_number
    from public.count_rounds
    where id = v_rejected_id;
  else
    select coalesce(max(round_number), 0) + 1
      into v_round_number
    from public.count_rounds
    where post_id = p_post_id
      and staff_id = v_staff;
  end if;

  begin
    if v_rejected_id is not null then
      v_round_id := v_rejected_id;

      delete from public.count_entries where round_id = v_round_id;

      update public.count_rounds
         set status = v_status,
             submitted_at = now(),
             verified_by = case when v_status = 'verified' then v_staff else null end,
             verified_at = case when v_status = 'verified' then now() else null end,
             remarks = null,
             is_finalised = false,
             invalid_votes = v_invalid,
             invalid_slot_votes = v_slots
       where id = v_round_id;
    else
      insert into public.count_rounds (
        post_id, staff_id, round_number, status, verified_by, verified_at, invalid_votes, invalid_slot_votes
      )
      values (
        p_post_id,
        v_staff,
        v_round_number,
        v_status,
        case when v_status = 'verified' then v_staff else null end,
        case when v_status = 'verified' then now() else null end,
        v_invalid,
        v_slots
      )
      returning id into v_round_id;
    end if;
  exception
    when unique_violation then
      raise exception 'Duplicate round detected. This round was already submitted.';
  end;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into public.count_entries (round_id, candidate_id, votes)
    values (
      v_round_id,
      (v_entry->>'candidate_id')::uuid,
      (v_entry->>'votes')::int
    );
  end loop;

  if v_status = 'verified' then
    perform public.maybe_finalise_post(p_post_id);
  end if;

  return jsonb_build_object(
    'id', v_round_id,
    'round_number', v_round_number,
    'status', v_status
  );
end;
$$;

grant execute on function public.submit_count_round(uuid, jsonb, integer, integer[]) to authenticated;
revoke execute on function public.submit_count_round(uuid, jsonb, integer, integer[]) from public, anon;

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
          p.votes_polled > 0
          and (
            coalesce((
              select sum(ce.votes)
              from public.count_entries ce
              join public.count_rounds cr on cr.id = ce.round_id
              where cr.post_id = p.id
                and cr.status = 'verified'
            ), 0)
            + coalesce((
              select sum(cr.invalid_votes)
              from public.count_rounds cr
              where cr.post_id = p.id
                and cr.status = 'verified'
            ), 0)
          ) >= p.votes_polled * greatest(coalesce(p.seats, 1), 1)
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
        'invalid_votes', (
          select coalesce(sum(cr.invalid_votes), 0)::int
          from public.count_rounds cr
          where cr.post_id = p.id
            and (
              cr.status = 'verified'
              or (not v_require_verification and cr.status = 'pending_verification')
            )
        ),
        'invalid_slot_votes', (
          select coalesce(jsonb_agg(slot.total order by slot.ord), '[]'::jsonb)
          from (
            select
              gs.ord,
              coalesce((
                select sum(
                  case
                    when coalesce(array_length(cr.invalid_slot_votes, 1), 0) >= gs.ord
                      then cr.invalid_slot_votes[gs.ord]
                    when gs.ord = 1 then cr.invalid_votes
                    else 0
                  end
                )
                from public.count_rounds cr
                where cr.post_id = p.id
                  and (
                    cr.status = 'verified'
                    or (not v_require_verification and cr.status = 'pending_verification')
                  )
              ), 0)::int as total
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

revoke execute on function public.get_live_results() from anon, public;
grant execute on function public.get_live_results() to authenticated;
