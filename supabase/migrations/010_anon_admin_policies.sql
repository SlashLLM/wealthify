-- Allow anon key (via server admin API) to read leads and update refinance options.
-- Safe to re-run.

grant usage on schema public to anon;
grant select, update on public.refinance_leads to anon;

drop policy if exists "anon_select_refinance_leads" on public.refinance_leads;

create policy "anon_select_refinance_leads"
  on public.refinance_leads
  for select
  to anon
  using (true);

drop policy if exists "anon_admin_update_refinance_options" on public.refinance_leads;

create policy "anon_admin_update_refinance_options"
  on public.refinance_leads
  for update
  to anon
  using (true)
  with check (true);

notify pgrst, 'reload schema';
