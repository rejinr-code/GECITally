-- Optional starter election data. Run AFTER 0001_init.sql and 0002_panels_and_post_votes.sql.
-- Posts follow the KTU College Students' Union structure used at GECI.
-- Does not create Auth users. Create users in the dashboard, then:
--   update public.profiles set role = 'admin' where id = '<your-user-uuid>';

insert into public.elections (name, date, total_votes_polled, count_limit, state)
select
  'GECI College Union Election 2026',
  '2026-09-16',
  1840,
  8,
  'setup'
where not exists (select 1 from public.elections);

do $$
declare
  v_election uuid;
begin
  select id into v_election from public.elections order by created_at desc limit 1;

  if not exists (select 1 from public.posts where election_id = v_election) then
    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values
      (v_election, 'Chairperson', 1, 1840, 1),
      (v_election, 'Vice-Chairperson', 1, 1840, 2),
      (v_election, 'General Secretary', 1, 1840, 3),
      (v_election, 'Editor of the College Magazine', 1, 1840, 4),
      (v_election, 'Arts Club Secretary', 1, 1840, 5),
      (v_election, 'University Union Councillors', 2, 1840, 6),
      (v_election, 'Women Representatives', 2, 1840, 7),
      (v_election, 'UG Representative - Computer Science & Engineering', 1, 1840, 8),
      (v_election, 'UG Representative - Electrical & Electronics Engineering', 1, 1840, 9),
      (v_election, 'UG Representative - Electronics & Communication Engineering', 1, 1840, 10),
      (v_election, 'UG Representative - Information Technology', 1, 1840, 11),
      (v_election, 'UG Representative - Robotics & AI', 1, 1840, 12),
      (v_election, 'UG Representative - Mechanical Engineering', 1, 1840, 13);
  end if;
end $$;
