-- Admins may delete or reset counts after posts are finalised.

create or replace function public.prevent_finalised_round_mutation()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() or current_setting('geci.allow_count_reset', true) = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.is_finalised then
      raise exception 'Finalised rounds cannot be modified or deleted';
    end if;
    return old;
  end if;

  if old.is_finalised then
    if new.is_finalised is distinct from old.is_finalised
       or new.status is distinct from old.status
       or new.round_number is distinct from old.round_number
       or new.post_id is distinct from old.post_id
       or new.staff_id is distinct from old.staff_id then
      raise exception 'Finalised rounds cannot be modified or deleted';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_finalised_entry_mutation()
returns trigger
language plpgsql
as $$
declare
  v_finalised boolean;
begin
  if public.is_admin() or current_setting('geci.allow_count_reset', true) = 'true' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select cr.is_finalised
    into v_finalised
  from public.count_rounds cr
  where cr.id = coalesce(new.round_id, old.round_id);

  if coalesce(v_finalised, false) then
    raise exception 'Entries on a finalised round cannot be modified or deleted';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

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

  update public.elections
     set state = 'setup'
   where id = p_election_id;
end;
$$;
