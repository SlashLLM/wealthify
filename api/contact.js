const { sendAdminContactNotification, sendContactAcknowledgement } = require('../lib/contact-emails');

const ENQUIRY_TYPES = ['Mortgages', 'Insurance', 'KiwiSaver', 'Loans', 'Other'];

const ADVISERS = {
  'amol-prakash': 'Amol Prakash',
  'shweta-bhatia': 'Shweta Bhatia',
  'jeeson-joseph': 'Jeeson Joseph',
};

const MAX_MESSAGE = 4000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 3;
const recentSubmissions = new Map();

function json(res, status, body) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function empty(res, status) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
    return empty(res, 204);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await readBody(req);

    // Honeypot: real people never fill this in.
    if (String(body.company || '').trim()) {
      return json(res, 200, { ok: true });
    }

    const full_name = String(body.full_name || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const message = String(body.message || '').trim();
    const enquiry_type = ENQUIRY_TYPES.includes(body.enquiry_type) ? body.enquiry_type : '';
    const adviserSlug = String(body.adviser || '').trim();
    const adviser_name = ADVISERS[adviserSlug] || null;

    if (!validateFullName(full_name)) {
      return json(res, 400, { error: 'Please enter your full name' });
    }
    if (!validateEmail(email)) {
      return json(res, 400, { error: 'Please enter a valid email address' });
    }
    if (!validatePhone(phone)) {
      return json(res, 400, { error: 'Please enter a valid mobile number' });
    }
    if (!enquiry_type) {
      return json(res, 400, { error: 'Please choose what your enquiry is about' });
    }
    if (message.length < 10) {
      return json(res, 400, { error: 'Please tell us a little more so we can help' });
    }
    if (message.length > MAX_MESSAGE) {
      return json(res, 400, { error: 'Your message is too long' });
    }
    if (body.consent !== true) {
      return json(res, 400, { error: 'Please agree to be contacted about your enquiry' });
    }

    if (isRateLimited(clientIp(req))) {
      return json(res, 429, { error: 'Too many submissions. Please try again shortly.' });
    }

    const enquiry = { full_name, email, phone, enquiry_type, message, adviser_name };

    await sendAdminContactNotification(enquiry);
    await sendContactAcknowledgement(enquiry);

    return json(res, 201, { ok: true });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    return json(res, status, { error: err.message || 'Server error' });
  }
};
