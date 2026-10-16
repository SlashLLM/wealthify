// Admin sign-in and sign-out. One function for both to stay within Vercel's
// serverless function limit.
//   POST ?action=login   { password }
//   POST ?action=logout
const {
  getAdminPassword,
  createSessionCookie,
  clearSessionCookie,
  readBody,
  json,
} = require('../_auth');

async function login(req, res) {
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
}

function logout(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return json(res, 200, { ok: true });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const action = new URL(req.url, 'http://localhost').searchParams.get('action');
  if (action === 'login') return login(req, res);
  if (action === 'logout') return logout(req, res);
  return json(res, 400, { error: 'Unknown action' });
};
