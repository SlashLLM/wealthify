const { requireAdmin, unauthorized, json } = require('../_auth');
const { supabaseRequest } = require('../_supabase');

const SELECT_FIELDS = 'id,program,full_name,email,phone,created_at';

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!requireAdmin(req)) return unauthorized(res);

  try {
    const { data } = await supabaseRequest('program_leads', {
      query: `select=${SELECT_FIELDS}&order=created_at.desc`,
    });
    return json(res, 200, { leads: data || [] });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return json(res, status, { error: err.message || 'Server error' });
  }
};
