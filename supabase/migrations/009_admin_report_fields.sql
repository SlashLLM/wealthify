-- Calculator snapshot + admin-only refinance options for PDF reports

alter table public.refinance_leads
  add column if not exists current_rate numeric,
  add column if not exists years_remaining integer,
  add column if not exists target_new_rate numeric default 4.79,
  add column if not exists cashback_pct numeric default 0.90,
  add column if not exists break_fee numeric default 0,
  add column if not exists legal_costs numeric default 1200;
