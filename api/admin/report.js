const { requireAdmin, unauthorized, json } = require('../_auth');
const { supabaseRequest } = require('../_supabase');
const { generateReportPdf } = require('../../lib/pdf-report');

const SELECT_FIELDS =
  'id,email,phone,property_address,loan_balance,current_rate,years_remaining,target_new_rate,cashback_pct,break_fee,legal_costs,source,created_at,updated_at';

function parseUrlId(req) {
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('id');
}

function safeFilename(email) {
  return String(email || 'lead')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 80);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!requireAdmin(req)) return unauthorized(res);

  const id = parseUrlId(req);
  if (!id) return json(res, 400, { error: 'Missing lead id' });

  try {
    const { data } = await supabaseRequest('refinance_leads', {
      query: `select=${SELECT_FIELDS}&id=eq.${encodeURIComponent(id)}`,
    });
    const lead = Array.isArray(data) ? data[0] : null;
    if (!lead) return json(res, 404, { error: 'Lead not found' });

    const pdf = await generateReportPdf(lead);

    const filename = `wealthify-refinance-report-${safeFilename(lead.email)}.pdf`;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return json(res, status, { error: err.message || 'Server error' });
  }
};
