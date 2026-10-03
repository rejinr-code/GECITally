-- Official Returning Officer name for counting sheets and the result declaration.

alter table public.elections
  add column if not exists returning_officer_name text;
