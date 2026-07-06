create table if not exists public.refinance_leads (

  id uuid primary key default gen_random_uuid(),

  session_token uuid not null default gen_random_uuid(),

  email text not null,

  phone text not null,

  property_address text,

  loan_balance numeric,

  source text default 'refinance-calculator',

  created_at timestamptz default now(),

  updated_at timestamptz default now()

);



create index if not exists refinance_leads_created_at_idx

  on public.refinance_leads (created_at desc);



alter table public.refinance_leads enable row level security;



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
