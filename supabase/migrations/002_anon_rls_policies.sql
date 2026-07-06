-- Upgrade path for databases created from an older 001 without session_token / RLS.
-- Safe to re-run: uses IF NOT EXISTS and DROP POLICY IF EXISTS.

alter table public.refinance_leads
  add column if not exists session_token uuid not null default gen_random_uuid();

drop policy if exists "anon_insert_refinance_leads" on public.refinance_leads;
drop policy if exists "anon_update_refinance_leads" on public.refinance_leads;

create policy "anon_insert_refinance_leads"
  on public.refinance_leads
  for insert
  to anon
  with check (
    email is not null
    and phone is not null
  );

create policy "anon_update_refinance_leads"
  on public.refinance_leads
  for update
  to anon
  using (
    property_address is null
    and created_at > (now() - interval '24 hours')
  )
  with check (
    property_address is not null
    and loan_balance is not null
  );

grant usage on schema public to anon;
grant insert, update on public.refinance_leads to anon;
