const { requireAdmin, unauthorized, json } = require('../_auth');

const UPSTREAM_URL = 'https://ratesapi.nz/api/v1/mortgage-rates';
const TIMEOUT_MS = 15000;

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!requireAdmin(req)) return unauthorized(res);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      return json(res, 502, { error: 'Failed to fetch mortgage rates' });
    }

    const data = await upstream.json();
    return json(res, 200, data);
  } catch (err) {
    clearTimeout(timer);
    const message = err.name === 'AbortError'
      ? 'Mortgage rates request timed out'
      : (err.message || 'Failed to fetch mortgage rates');
    return json(res, 502, { error: message });
  }
};
