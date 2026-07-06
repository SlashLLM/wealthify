-- Allow anon to insert leads with all fields (step-2 complete submit).
-- Safe to re-run.

drop policy if exists "anon_insert_refinance_leads" on public.refinance_leads;

create policy "anon_insert_refinance_leads"
  on public.refinance_leads
  for insert
  to anon
  with check (
    email is not null
    and phone is not null
  );

grant usage on schema public to anon;
grant insert on public.refinance_leads to anon;

notify pgrst, 'reload schema';
