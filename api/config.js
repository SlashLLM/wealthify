const { resolveCalculatorRate, fetchMortgageRates } = require('../lib/calculator-rate');

function setCorsHeaders(req, res, methods = 'GET, OPTIONS') {
  const origin = req.headers && req.headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      const isAllowedDomain = parsed.hostname.endsWith('wealthify.co.nz') || parsed.hostname.endsWith('vercel.app');
      if (isLocalhost || isAllowedDomain) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
    } catch {
      // ignore invalid origin header
    }
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(req, res, status, body) {
  setCorsHeaders(req, res, 'GET, OPTIONS');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res, 'GET, OPTIONS');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    return json(req, res, 405, { error: 'Method not allowed' });
  }

  let calculatorNewRate;
  let calculatorRateSource;
  try {
    const resolved = await resolveCalculatorRate();
    calculatorNewRate = resolved.rate;
    calculatorRateSource = resolved.source;
  } catch {
    calculatorNewRate = 4.79;
    calculatorRateSource = 'fallback';
  }

  let banks = [];
  try {
    const rates = await fetchMortgageRates();
    banks = (rates.data || [])
      .map(inst => ({ id: inst.id, name: inst.name }))
      .filter(b => b.id && b.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    banks = [];
  }

  const googlePlacesApiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
  const body = {
    calculatorNewRate,
    calculatorRateSource,
    banks,
  };
  if (googlePlacesApiKey) {
    body.googlePlacesApiKey = googlePlacesApiKey;
  }

  return json(req, res, 200, body);
};
