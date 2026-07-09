alter table public.refinance_leads
  add column if not exists bank_name text;

notify pgrst, 'reload schema';
