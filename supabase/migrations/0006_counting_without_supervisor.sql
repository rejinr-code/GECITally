-- Let admin allow counting to continue without waiting for supervisor verification.

alter table public.elections
  add column if not exists counting_require_verification boolean not null default true;

create or replace function public.submit_count_round(
  p_post_id uuid,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff uuid := auth.uid();
  v_election public.elections%rowtype;
  v_candidate_count integer;
  v_entry_count integer;
  v_pending integer;
  v_verified integer;
  v_rejected_id uuid;
  v_round_number integer;
  v_round_id uuid;
  v_entry jsonb;
  v_require_review boolean;
  v_status public.round_status;
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

  if v_election.state <> 'counting' then
    raise exception 'Counting is not open for this election';
  end if;

  v_require_review := coalesce(v_election.counting_require_verification, true);
  v_status := case when v_require_review then 'pending_verification'::public.round_status else 'verified'::public.round_status end;

  perform 1 from public.elections where id = v_election.id for update;
  perform 1 from public.posts where id = p_post_id for update;

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

  select count(*) into v_verified
  from public.count_rounds
  where post_id = p_post_id
    and status = 'verified';

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
    if v_verified >= v_election.count_limit then
      raise exception 'Count limit reached for this post. Ask the admin to raise the finalisation limit.';
    end if;

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
             is_finalised = false
       where id = v_round_id;
    else
      insert into public.count_rounds (post_id, staff_id, round_number, status, verified_by, verified_at)
      values (
        p_post_id,
        v_staff,
        v_round_number,
        v_status,
        case when v_status = 'verified' then v_staff else null end,
        case when v_status = 'verified' then now() else null end
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

grant execute on function public.submit_count_round(uuid, jsonb) to authenticated;

create or replace function public.accept_pending_on_counting_mode()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post uuid;
begin
  if new.counting_require_verification = false
     and coalesce(old.counting_require_verification, true) = true then
    update public.count_rounds cr
       set status = 'verified',
           verified_by = coalesce(cr.verified_by, auth.uid()),
           verified_at = coalesce(cr.verified_at, now())
     where cr.status = 'pending_verification'
       and cr.post_id in (select id from public.posts where election_id = new.id);

    for v_post in
      select id from public.posts where election_id = new.id
    loop
      perform public.maybe_finalise_post(v_post);
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_accept_pending_on_counting_mode on public.elections;
create trigger trg_accept_pending_on_counting_mode
  after update of counting_require_verification on public.elections
  for each row execute function public.accept_pending_on_counting_mode();
