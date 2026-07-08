const { requireAdmin, unauthorized, json } = require('../_auth');
const { fetchMortgageRates } = require('../../lib/calculator-rate');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!requireAdmin(req)) return unauthorized(res);

  try {
    const data = await fetchMortgageRates();
    return json(res, 200, data);
  } catch (err) {
    const message = err.name === 'AbortError'
      ? 'Mortgage rates request timed out'
      : (err.message || 'Failed to fetch mortgage rates');
    return json(res, 502, { error: message });
  }
};
