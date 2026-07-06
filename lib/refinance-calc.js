const CASH_CAP = 20000;

function pmt(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function totalInterest(principal, annualRate, years) {
  return pmt(principal, annualRate, years) * years * 12 - principal;
}

function fmt(n) {
  return Math.abs(Math.round(n)).toLocaleString('en-NZ');
}

function computeRefinance({
  loan_balance,
  current_rate,
  years_remaining,
  target_new_rate,
  cashback_pct,
  break_fee,
  legal_costs,
}) {
  const bal = Number(loan_balance) || 0;
  const rate = Number(current_rate) || 6.49;
  const term = Math.max(1, Math.round(Number(years_remaining) || 25));
  const newR = Number(target_new_rate) || 4.79;
  const cashP = Number(cashback_pct) || 0.9;
  const brk = Number(break_fee) || 0;
  const legal = Number(legal_costs) || 1200;

  const payCur = pmt(bal, rate, term);
  const payNew = pmt(bal, newR, term);
  const intSaved = Math.max(0, totalInterest(bal, rate, term) - totalInterest(bal, newR, term));
  const moSaved = Math.max(0, payCur - payNew);
  const cashback = Math.min((bal * cashP) / 100, CASH_CAP);
  const switchCost = brk + legal;
  const netYr1 = cashback - switchCost;

  return {
    loan_balance: bal,
    current_rate: rate,
    years_remaining: term,
    target_new_rate: newR,
    cashback_pct: cashP,
    break_fee: brk,
    legal_costs: legal,
    monthly_payment_current: payCur,
    monthly_payment_new: payNew,
    monthly_saving: moSaved,
    interest_saved: intSaved,
    cashback,
    switch_cost: switchCost,
    net_year1: netYr1,
    fmt,
  };
}

module.exports = { computeRefinance, pmt, totalInterest, fmt, CASH_CAP };
