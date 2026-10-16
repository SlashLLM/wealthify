function getSupabaseConfig({ service = false } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = service ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(service
      ? 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
      : 'Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return { url, key };
}

function rowsAffected(contentRange) {
  if (!contentRange) return null;
  const total = contentRange.split('/')[1];
  if (!total || total === '*') return null;
  return parseInt(total, 10);
}

// `service: true` uses the service-role key (bypasses RLS) — server-only, for
// admin writes that must not be possible with the public anon key.
async function supabaseRequest(path, { method = 'GET', body, prefer, query, service = false } = {}) {
  const { url, key } = getSupabaseConfig({ service });
  const qs = query ? `?${query}` : '';
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${url}/rest/v1/${path}${qs}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data && data.message) ||
      (data && data.error) ||
      (typeof data === 'string' ? data : 'Supabase request failed');
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return {
    data,
    headers: res.headers,
    rowsAffected: rowsAffected(res.headers.get('content-range')),
  };
}

module.exports = { supabaseRequest, rowsAffected, getSupabaseConfig };
