const { supabaseRequest } = require('./_supabase');
const { sendAdminLeadNotification, sendClientThankYou } = require('../lib/lead-emails');
const { resolveCalculatorRate, FALLBACK_RATE } = require('../lib/calculator-rate');

const DEFAULT_NEW_RATE = FALLBACK_RATE;
const DEFAULT_CASH_PCT = 0.90;
const DEFAULT_BREAK_FEE = 0;
const DEFAULT_LEGAL = 1200;

function json(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function empty(res, status) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.statusCode = status;
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validatePhone(phone) {
  return String(phone || '').replace(/\D/g, '').length >= 8;
}

function validateFullName(name) {
  return String(name || '').trim().length >= 2;
}

function parseLoanBalance(value) {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRate(value) {
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseYears(value) {
  const n = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function resolveStep(body) {
  if (body.step === 1 || body.step === '1') return 1;
  if (body.step === 2 || body.step === '2') return 2;
  if (!String(body.property_address || '').trim()) return 1;
  return 2;
}

function leadQuery(email, phone) {
  return `email=eq.${encodeURIComponent(email)}&phone=eq.${encodeURIComponent(phone)}&property_address=is.null&order=created_at.desc&limit=1&select=id`;
}

async function findIncompleteLead(email, phone) {
  const { data } = await supabaseRequest('refinance_leads', {
    query: leadQuery(email, phone),
  });
  return Array.isArray(data) && data[0] ? data[0].id : null;
}

async function getTargetNewRate() {
  try {
    const resolved = await resolveCalculatorRate();
    return resolved.rate;
  } catch {
    return DEFAULT_NEW_RATE;
  }
}

function parseBankName(value) {
  const name = String(value || '').trim();
  return name || null;
}

async function saveStep1({ full_name, email, phone, current_rate, years_remaining, loan_balance, target_new_rate, bank_name }) {
  const payload = {
    full_name,
    email,
    phone,
    current_rate,
    years_remaining,
    loan_balance,
    target_new_rate,
    cashback_pct: DEFAULT_CASH_PCT,
    break_fee: DEFAULT_BREAK_FEE,
    legal_costs: DEFAULT_LEGAL,
    source: 'refinance-calculator',
    updated_at: new Date().toISOString(),
  };
  if (bank_name) payload.bank_name = bank_name;

  const existingId = await findIncompleteLead(email, phone);
  if (existingId) {
    await supabaseRequest('refinance_leads', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(existingId)}`,
      body: payload,
      prefer: 'return=minimal',
    });
    return;
  }

  await supabaseRequest('refinance_leads', {
    method: 'POST',
    body: payload,
    prefer: 'return=minimal',
  });
}

async function saveStep2({
  full_name,
  email,
  phone,
  property_address,
  loan_balance,
  current_rate,
  years_remaining,
  target_new_rate,
  bank_name,
}) {
  const existingId = await findIncompleteLead(email, phone);
  const payload = {
    full_name,
    email,
    phone,
    property_address,
    loan_balance,
    current_rate,
    years_remaining,
    target_new_rate,
    bank_name,
    cashback_pct: DEFAULT_CASH_PCT,
    break_fee: DEFAULT_BREAK_FEE,
    legal_costs: DEFAULT_LEGAL,
    source: 'refinance-calculator',
    updated_at: new Date().toISOString(),
  };

  if (existingId) {
    await supabaseRequest('refinance_leads', {
      method: 'PATCH',
      query: `id=eq.${encodeURIComponent(existingId)}`,
      body: payload,
      prefer: 'return=minimal',
    });
    return;
  }

  await supabaseRequest('refinance_leads', {
    method: 'POST',
    body: payload,
    prefer: 'return=minimal',
  });
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return empty(res, 204);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    const step = resolveStep(body);
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const full_name = String(body.full_name || '').trim();
    const current_rate = parseRate(body.current_rate);
    const years_remaining = parseYears(body.years_remaining);

    if (!validateFullName(full_name)) {
      return json(res, 400, { error: 'Full name is required' });
    }
    if (!validateEmail(email)) {
      return json(res, 400, { error: 'Invalid email address' });
    }
    if (!validatePhone(phone)) {
      return json(res, 400, { error: 'Invalid mobile number' });
    }
    if (current_rate === null) {
      return json(res, 400, { error: 'Invalid current rate' });
    }
    if (years_remaining === null) {
      return json(res, 400, { error: 'Invalid years remaining' });
    }

    const target_new_rate = await getTargetNewRate();

    if (step === 1) {
      const loan_balance = parseLoanBalance(body.loan_balance);
      if (loan_balance === null) {
        return json(res, 400, { error: 'Invalid loan balance' });
      }

      const bank_name = parseBankName(body.bank_name);
      await saveStep1({ full_name, email, phone, current_rate, years_remaining, loan_balance, target_new_rate, bank_name });
      await sendAdminLeadNotification({ full_name, email, phone, current_rate, years_remaining, loan_balance, bank_name });
      return json(res, 201, { ok: true });
    }

    const property_address = String(body.property_address || '').trim();
    const loan_balance = parseLoanBalance(body.loan_balance);
    const bank_name = parseBankName(body.bank_name);

    if (!property_address) {
      return json(res, 400, { error: 'Property address is required' });
    }
    if (loan_balance === null) {
      return json(res, 400, { error: 'Invalid loan balance' });
    }
    if (!bank_name) {
      return json(res, 400, { error: 'Current bank is required' });
    }

    await saveStep2({
      full_name,
      email,
      phone,
      property_address,
      loan_balance,
      current_rate,
      years_remaining,
      target_new_rate,
      bank_name,
    });

    await sendClientThankYou({
      email,
      phone,
      property_address,
      loan_balance,
      current_rate,
      years_remaining,
    });

    return json(res, 201, { ok: true });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return json(res, status, { error: err.message || 'Server error' });
  }
};
