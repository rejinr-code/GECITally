-- Hall / public results require a dedicated display login. Stop anonymous live totals.

alter type public.user_role add value if not exists 'display';

revoke execute on function public.get_live_results() from anon;
grant execute on function public.get_live_results() to authenticated;

drop policy if exists "results_tick_public_read" on public.results_tick;
create policy "results_tick_auth_read" on public.results_tick
  for select using (auth.uid() is not null);

revoke select on public.results_tick from anon;
grant select on public.results_tick to authenticated;
