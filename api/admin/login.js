const {
  getAdminPassword,
  createSessionCookie,
  readBody,
  json,
} = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);
    const password = String(body.password || '');
    if (!password || password !== getAdminPassword()) {
      return json(res, 401, { error: 'Invalid password' });
    }
    res.setHeader('Set-Cookie', createSessionCookie(req));
    return json(res, 200, { ok: true });
  } catch (err) {
    return json(res, 500, { error: err.message || 'Server error' });
  }
};
