-- Match step-2 updates by email + phone (step-1 id from the API may not match the DB row).
-- Safe to re-run.

create or replace function public.complete_refinance_lead(
  lead_email text,
  lead_phone text,
  address text,
  balance numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id
  from public.refinance_leads
  where email = lead_email
    and phone = lead_phone
    and property_address is null
    and (loan_balance is null or loan_balance = 0)
  order by created_at desc
  limit 1;

  if target_id is null then
    raise exception 'Lead not found or already completed';
  end if;

  update public.refinance_leads
  set
    property_address = address,
    loan_balance = balance,
    updated_at = now()
  where id = target_id;
end;
$$;

grant execute on function public.complete_refinance_lead(text, text, text, numeric) to anon;

-- Drop old signature if it exists from a previous migration run.
drop function if exists public.complete_refinance_lead(uuid, text, numeric);
