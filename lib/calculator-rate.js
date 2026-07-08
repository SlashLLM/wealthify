const { supabaseRequest } = require('../api/_supabase');

const UPSTREAM_URL = 'https://ratesapi.nz/api/v1/mortgage-rates';
const TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_RATE = 4.79;
const AUTO_SPECIAL_TERM_MONTHS = 12;
const SETTINGS_ID = 1;

let mortgageRatesCache = null;
let mortgageRatesCacheAt = 0;

function isSpecialProduct(name) {
  return name === 'Special';
}

function lowestSpecialRate(institutions, termInMonths = AUTO_SPECIAL_TERM_MONTHS) {
  let best = null;
  for (const inst of institutions || []) {
    for (const product of inst.products || []) {
      if (!isSpecialProduct(product.name)) continue;
      for (const rate of product.rates || []) {
        if (rate.termInMonths !== termInMonths) continue;
        const value = Number(rate.rate);
        if (!Number.isFinite(value) || value <= 0) continue;
        if (!best || value < best.rate) {
          best = {
            rate: value,
            institution: inst.name,
            product: product.name,
            term: rate.term,
          };
        }
      }
    }
  }
  return best;
}

async function fetchMortgageRates({ force = false } = {}) {
  const now = Date.now();
  if (!force && mortgageRatesCache && now - mortgageRatesCacheAt < CACHE_TTL_MS) {
    return mortgageRatesCache;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch(UPSTREAM_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      throw new Error('Failed to fetch mortgage rates');
    }

    const data = await upstream.json();
    mortgageRatesCache = data;
    mortgageRatesCacheAt = now;
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (mortgageRatesCache) return mortgageRatesCache;
    throw err;
  }
}

async function loadSettings() {
  try {
    const { data } = await supabaseRequest('calculator_rate_settings', {
      query: `id=eq.${SETTINGS_ID}&select=manual_enabled,manual_rate,updated_at&limit=1`,
    });
    if (Array.isArray(data) && data[0]) return data[0];
  } catch {
    // Table may not exist yet — fall back to defaults.
  }
  return { manual_enabled: false, manual_rate: null, updated_at: null };
}

function parseManualRate(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n >= 0.01 && n <= 20 ? n : null;
}

function validateManualRate(value) {
  const rate = parseManualRate(value);
  if (rate === null) return null;
  return rate;
}

async function saveSettings({ manual_enabled, manual_rate }) {
  const body = {
    updated_at: new Date().toISOString(),
  };
  if (manual_enabled !== undefined) body.manual_enabled = !!manual_enabled;
  if (manual_rate !== undefined) body.manual_rate = manual_rate;

  const { data } = await supabaseRequest('calculator_rate_settings', {
    method: 'PATCH',
    query: `id=eq.${SETTINGS_ID}`,
    body,
    prefer: 'return=representation',
  });

  if (Array.isArray(data) && data[0]) return data[0];

  const inserted = await supabaseRequest('calculator_rate_settings', {
    method: 'POST',
    body: { id: SETTINGS_ID, ...body },
    prefer: 'return=representation',
  });
  return Array.isArray(inserted.data) && inserted.data[0] ? inserted.data[0] : body;
}

async function resolveAutoRate() {
  try {
    const data = await fetchMortgageRates();
    const detail = lowestSpecialRate(data.data || []);
    if (detail) {
      return { rate: detail.rate, source: 'auto', autoDetail: detail };
    }
  } catch {
    // Fall through to fallback.
  }
  return null;
}

async function resolveCalculatorRate() {
  const settings = await loadSettings();
  const manualEnabled = !!settings.manual_enabled;
  const manualRate = parseManualRate(settings.manual_rate);

  if (manualEnabled && manualRate !== null) {
    return { rate: manualRate, source: 'manual', manualEnabled: true, manualRate };
  }

  const auto = await resolveAutoRate();
  if (auto) {
    return {
      rate: auto.rate,
      source: 'auto',
      autoDetail: auto.autoDetail,
      manualEnabled: false,
      manualRate,
    };
  }

  if (manualRate !== null) {
    return { rate: manualRate, source: 'fallback', manualEnabled: false, manualRate };
  }

  return { rate: FALLBACK_RATE, source: 'fallback', manualEnabled: false, manualRate: null };
}

async function getCalculatorRateSettingsView() {
  const settings = await loadSettings();
  const manualEnabled = !!settings.manual_enabled;
  const manualRate = parseManualRate(settings.manual_rate);
  const auto = await resolveAutoRate();

  let effectiveRate = FALLBACK_RATE;
  let source = 'fallback';

  if (manualEnabled && manualRate !== null) {
    effectiveRate = manualRate;
    source = 'manual';
  } else if (auto) {
    effectiveRate = auto.rate;
    source = 'auto';
  } else if (manualRate !== null) {
    effectiveRate = manualRate;
    source = 'fallback';
  }

  return {
    manualEnabled,
    manualRate,
    effectiveRate,
    autoRate: auto ? auto.rate : null,
    autoDetail: auto ? auto.autoDetail : null,
    source,
    updatedAt: settings.updated_at || null,
  };
}

module.exports = {
  UPSTREAM_URL,
  TIMEOUT_MS,
  FALLBACK_RATE,
  AUTO_SPECIAL_TERM_MONTHS,
  isSpecialProduct,
  lowestSpecialRate,
  fetchMortgageRates,
  loadSettings,
  saveSettings,
  parseManualRate,
  validateManualRate,
  resolveCalculatorRate,
  getCalculatorRateSettingsView,
};
