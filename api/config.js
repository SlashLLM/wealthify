const { resolveCalculatorRate } = require('../lib/calculator-rate');

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

  const googlePlacesApiKey = String(process.env.GOOGLE_PLACES_API_KEY || '').trim();
  const body = {
    calculatorNewRate,
    calculatorRateSource,
  };
  if (googlePlacesApiKey) {
    body.googlePlacesApiKey = googlePlacesApiKey;
  }

  return json(res, 200, body);
};
