const { supabaseRequest } = require('./_supabase');
const { PROGRAMS, sendAdminProgramNotification } = require('../lib/program-emails');

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 3;
const recentSubmissions = new Map();

function setCorsHeaders(req, res, methods = 'POST, OPTIONS') {
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
      // ignore invalid origin
    }
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(req, res, status, body) {
  setCorsHeaders(req, res, 'POST, OPTIONS');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function empty(req, res, status) {
  setCorsHeaders(req, res, 'POST, OPTIONS');
  res.statusCode = status;
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 64 * 1024) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validatePhone(phone) {
  return String(phone || '').replace(/\D/g, '').length >= 8;
}

function validateFullName(name) {
  return String(name || '').trim().length >= 2;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  for (const [key, times] of recentSubmissions) {
    const kept = times.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (kept.length) recentSubmissions.set(key, kept);
    else recentSubmissions.delete(key);
  }
  const times = recentSubmissions.get(ip) || [];
  if (times.length >= RATE_LIMIT_MAX) return true;
  times.push(now);
  recentSubmissions.set(ip, times);
  return false;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    return empty(req, res, 204);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(req, res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);

    // Honeypot: real people never fill this in.
    if (String(body.company || '').trim()) {
      return json(req, res, 200, { ok: true });
    }

    const program = String(body.program || '').trim();
    const full_name = String(body.full_name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();

    if (!PROGRAMS[program]) {
      return json(req, res, 400, { error: 'Unknown sign-up type' });
    }
    if (!validateFullName(full_name)) {
      return json(req, res, 400, { error: 'Please enter your full name' });
    }
    if (!validateEmail(email)) {
      return json(req, res, 400, { error: 'Please enter a valid email address' });
    }
    if (!validatePhone(phone)) {
      return json(req, res, 400, { error: 'Please enter a valid mobile number' });
    }
    if (body.consent !== true) {
      return json(req, res, 400, { error: 'Please agree to be contacted so we can get back to you' });
    }

    if (isRateLimited(clientIp(req))) {
      return json(req, res, 429, { error: 'Too many submissions. Please try again shortly.' });
    }

    // Persist first — a mail outage must never lose a captured lead.
    const { data } = await supabaseRequest('program_leads', {
      method: 'POST',
      body: { program, full_name, email, phone },
      prefer: 'return=representation',
    });

    const lead = (Array.isArray(data) && data[0]) || { program, full_name, email, phone };

    try {
      await sendAdminProgramNotification(lead);
    } catch (err) {
      console.error('[email] Failed to send program notification:', err.message);
    }

    return json(req, res, 201, { ok: true });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return json(req, res, status, { error: err.message || 'Server error' });
  }
};
