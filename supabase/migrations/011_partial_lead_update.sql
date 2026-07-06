-- Allow anon to save step-1 partial leads (rate, term, balance) before address is provided.
-- Safe to re-run.

drop policy if exists "anon_partial_update_refinance_leads" on public.refinance_leads;

create policy "anon_partial_update_refinance_leads"
  on public.refinance_leads
  for update
  to anon
  using (property_address is null)
  with check (property_address is null);

notify pgrst, 'reload schema';
