const { clearSessionCookie, json } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  res.setHeader('Set-Cookie', clearSessionCookie());
  return json(res, 200, { ok: true });
};
