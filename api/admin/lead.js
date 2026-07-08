const { requireAdmin, unauthorized, readBody, json } = require('../_auth');
const { supabaseRequest } = require('../_supabase');

const SELECT_FIELDS =
  'id,full_name,email,phone,property_address,loan_balance,current_rate,years_remaining,target_new_rate,cashback_pct,break_fee,legal_costs,source,created_at,updated_at';

function parseNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseUrlId(req) {
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('id');
}

module.exports = async (req, res) => {
  if (!requireAdmin(req)) return unauthorized(res);

  const id = parseUrlId(req);
  if (!id) return json(res, 400, { error: 'Missing lead id' });

  if (req.method === 'GET') {
    try {
      const { data } = await supabaseRequest('refinance_leads', {
        query: `select=${SELECT_FIELDS}&id=eq.${encodeURIComponent(id)}`,
      });
      const lead = Array.isArray(data) ? data[0] : null;
      if (!lead) return json(res, 404, { error: 'Lead not found' });
      return json(res, 200, { lead });
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return json(res, status, { error: err.message || 'Server error' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = await readBody(req);
      const updates = {};

      // Report-scenario fields (already editable pre-handoff)
      if (body.target_new_rate !== undefined) {
        const v = parseNumber(body.target_new_rate);
        if (v === null) return json(res, 400, { error: 'Invalid target new rate' });
        updates.target_new_rate = v;
      }
      if (body.cashback_pct !== undefined) {
        const v = parseNumber(body.cashback_pct);
        if (v === null) return json(res, 400, { error: 'Invalid cashback percentage' });
        updates.cashback_pct = v;
      }
      if (body.break_fee !== undefined) {
        const v = parseNumber(body.break_fee);
        if (v === null) return json(res, 400, { error: 'Invalid break fee' });
        updates.break_fee = v;
      }
      if (body.legal_costs !== undefined) {
        const v = parseNumber(body.legal_costs);
        if (v === null) return json(res, 400, { error: 'Invalid legal costs' });
        updates.legal_costs = v;
      }

      // New: client/loan fields, so admins can correct or refine the
      // details captured from the calculator before generating a report.
      if (body.loan_balance !== undefined) {
        const v = parseNumber(body.loan_balance);
        if (v === null) return json(res, 400, { error: 'Invalid loan balance' });
        updates.loan_balance = v;
      }
      if (body.current_rate !== undefined) {
        const v = parseNumber(body.current_rate);
        if (v === null) return json(res, 400, { error: 'Invalid current rate' });
        updates.current_rate = v;
      }
      if (body.years_remaining !== undefined) {
        const v = parseNumber(body.years_remaining);
        if (v === null) return json(res, 400, { error: 'Invalid years remaining' });
        updates.years_remaining = v;
      }

      if (!Object.keys(updates).length) {
        return json(res, 400, { error: 'No valid fields to update' });
      }

      updates.updated_at = new Date().toISOString();

      const { data } = await supabaseRequest('refinance_leads', {
        method: 'PATCH',
        query: `id=eq.${encodeURIComponent(id)}`,
        body: updates,
        prefer: 'return=representation',
      });

      const lead = Array.isArray(data) ? data[0] : null;
      if (!lead) return json(res, 404, { error: 'Lead not found' });
      return json(res, 200, { lead });
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return json(res, status, { error: err.message || 'Server error' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return json(res, 405, { error: 'Method not allowed' });
};
