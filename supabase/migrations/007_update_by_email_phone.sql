-- Allow anon to complete step 2 (update address + balance on existing lead).
-- Run once in Supabase SQL Editor. Safe to re-run.

grant usage on schema public to anon;
grant insert, update on public.refinance_leads to anon;

drop policy if exists "anon_update_refinance_leads" on public.refinance_leads;

create policy "anon_update_refinance_leads"
  on public.refinance_leads
  for update
  to anon
  using (property_address is null)
  with check (
    property_address is not null
    and loan_balance is not null
  );

notify pgrst, 'reload schema';
