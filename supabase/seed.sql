-- Local test data. Loaded by `npm run db:start` (first run) and `npm run db:reset`.
-- Never run against production. All names, emails and phone numbers are fake.

-- ── Refinance leads (admin → Refinance Leads) ──────────────────────────────
insert into public.refinance_leads
  (full_name, email, phone, bank_name, property_address, loan_balance, current_rate, years_remaining, source, created_at)
values
  ('Test Aroha Ngata', 'aroha.test@example.com', '021 000 0001', 'ANZ', '12 Test Street, Dunedin 9016', 520000, 6.49, 24, 'refinance-calculator', now() - interval '1 day'),
  ('Test Liam Patel', 'liam.test@example.com', '022 000 0002', 'ASB', '8 Sample Road, Christchurch 8011', 410000, 5.99, 19, 'refinance-calculator', now() - interval '3 days'),
  ('Test Mia Chen', 'mia.test@example.com', '027 000 0003', 'Westpac', null, null, null, null, 'refinance-calculator', now() - interval '9 days');

-- ── Program sign-ups (admin → Programs) ────────────────────────────────────
insert into public.program_leads (program, full_name, email, phone, created_at)
values
  ('partner-circle', 'Test Sam Wilson', 'sam.test@example.com', '021 000 0004', now() - interval '2 days'),
  ('wealthify-score', 'Test Grace Kim', 'grace.test@example.com', '022 000 0005', now() - interval '5 days');

-- ── Blog posts (/blog and admin → Blog) ────────────────────────────────────
-- One of each state: live + featured, live, scheduled (future), draft.
insert into public.blog_posts
  (slug, title, excerpt, content_md, category, tags, author_name, author_role, status, featured, published_at, reading_minutes)
values
  (
    'fixed-or-floating-mortgage',
    'Fixed or floating? How to structure your mortgage',
    'A plain-English guide to the trade-offs, with the questions our advisers ask every client before they fix.',
    E'Choosing between fixed and floating is one of the biggest decisions on your home loan.\n\n## The short answer\n\nMost Kiwi borrowers **split** their loan: part fixed for certainty, part floating for flexibility. Try our [refinance calculator](/Tools.dc.html) to test the numbers.\n\n## Fixed rates\n\n- Repayments stay the same for the term\n- Break fees can apply if you repay early\n- Usually lower than floating rates\n\n## Comparing the options\n\n| Option | Rate | Flexibility |\n|---|---:|---|\n| 1-year fixed | 4.79% | Low |\n| 2-year fixed | 4.89% | Low |\n| Floating | 6.20% | High |\n\n> The best structure is the one that fits your plans for the next few years.\n\n## What to do next\n\n1. Check when your fixed term ends\n2. Compare rates across lenders\n3. Talk to an adviser about splitting',
    'Mortgages', array['mortgages', 'rates'], 'Amol Prakash', 'Director & Mortgage Adviser',
    'published', true, now() - interval '2 days', 2
  ),
  (
    'first-home-buyer-checklist',
    'First home buyer checklist: what lenders look for',
    'Deposit, income, spending and credit history — how banks assess a first home loan and how to get ready.',
    E'Buying your first home is exciting — and lenders will look closely at your finances.\n\n## Your deposit\n\nMost banks want a **20% deposit**, but First Home Loans can go as low as 5%.\n\n## Your spending\n\nLenders review three months of bank statements. Cut back on buy-now-pay-later before you apply.\n\n## Your credit history\n\nCheck your credit report for free and fix any errors early.',
    'First Home Buyers', array['first home', 'deposit'], 'Shweta Karne', 'Director & Mortgage Adviser',
    'published', false, now() - interval '6 days', 1
  ),
  (
    'refinancing-when-to-break',
    'Refinancing: when breaking your fixed rate makes sense',
    'Break fees, cashback and the maths of switching lenders mid-term.',
    E'Sometimes paying a break fee is worth it.\n\n## Do the maths\n\nCompare the break fee with the interest you will save over the remaining term.',
    'Refinancing', array['refinance'], 'Jeeson Joseph', 'Director & Mortgage Adviser',
    'published', false, now() + interval '3 days', 1
  ),
  (
    'investment-property-basics',
    'Investment property: the basics',
    'Draft — not visible on the public blog.',
    E'Work in progress.\n\n## Deposit rules for investors\n\nTo be written.',
    'Property Investment', array['investment'], 'Wealthify Team', null,
    'draft', false, null, 1
  );
