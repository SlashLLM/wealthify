const { resolveCalculatorRate, fetchMortgageRates } = require('../lib/calculator-rate');

function json(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
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

  return json(res, 200, body);
};
