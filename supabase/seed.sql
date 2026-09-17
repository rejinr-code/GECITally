-- Optional demo election data. Run AFTER 0001_init.sql and 0002_panels_and_post_votes.sql.
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
  v_chairman uuid;
  v_vice uuid;
  v_secretary uuid;
  v_joint uuid;
  v_exec uuid;
  v_editor uuid;
begin
  select id into v_election from public.elections order by created_at desc limit 1;

  if not exists (select 1 from public.posts where election_id = v_election) then
    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values (v_election, 'Chairman', 1, 1840, 1)
    returning id into v_chairman;

    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values (v_election, 'Vice Chairman', 1, 1840, 2)
    returning id into v_vice;

    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values (v_election, 'Secretary', 1, 1840, 3)
    returning id into v_secretary;

    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values (v_election, 'Joint Secretary', 1, 1840, 4)
    returning id into v_joint;

    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values (v_election, 'Executive Member', 5, 1840, 5)
    returning id into v_exec;

    insert into public.posts (election_id, name, seats, votes_polled, display_order)
    values (v_election, 'Magazine Editor', 1, 1840, 6)
    returning id into v_editor;

    insert into public.panels (election_id, name, display_order)
    values
      (v_election, 'Unity Panel', 1),
      (v_election, 'Progress Panel', 2);

    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_chairman, 'Arjun Menon', id, 1 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_chairman, 'Niveditha Raj', id, 2 from public.panels where election_id = v_election and name = 'Progress Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_vice, 'Fahad Rahman', id, 1 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_vice, 'Sneha Thomas', id, 2 from public.panels where election_id = v_election and name = 'Progress Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_secretary, 'Adithya Kumar', id, 1 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_secretary, 'Meera Nair', id, 2 from public.panels where election_id = v_election and name = 'Progress Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_joint, 'Rahul Krishnan', id, 1 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_joint, 'Anjali Suresh', id, 2 from public.panels where election_id = v_election and name = 'Progress Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_exec, 'Vishnu Prasad', id, 1 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_exec, 'Diya Mathew', id, 2 from public.panels where election_id = v_election and name = 'Progress Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    values (v_exec, 'Mohammed Irfan', null, 3);
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_exec, 'Kavya Ramesh', id, 4 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_exec, 'Joel Abraham', id, 5 from public.panels where election_id = v_election and name = 'Progress Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    values (v_exec, 'Aisha Banu', null, 6);
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_exec, 'Santhosh P', id, 7 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_editor, 'Neha Fathima', id, 1 from public.panels where election_id = v_election and name = 'Unity Panel';
    insert into public.candidates (post_id, name, panel_id, display_order)
    select v_editor, 'Abhinav Gopal', id, 2 from public.panels where election_id = v_election and name = 'Progress Panel';
  end if;
end $$;
