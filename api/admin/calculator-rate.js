const { requireAdmin, unauthorized, readBody, json } = require('../_auth');
const {
  getCalculatorRateSettingsView,
  saveSettings,
  validateManualRate,
  parseManualRate,
  loadSettings,
} = require('../../lib/calculator-rate');

module.exports = async (req, res) => {
  if (!requireAdmin(req)) return unauthorized(res);

  if (req.method === 'GET') {
    try {
      const view = await getCalculatorRateSettingsView();
      return json(res, 200, view);
    } catch (err) {
      return json(res, 500, { error: err.message || 'Failed to load calculator rate settings' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const body = await readBody(req);
      const current = await loadSettings();
      const manualEnabled = body.manualEnabled !== undefined
        ? !!body.manualEnabled
        : !!current.manual_enabled;

      let manualRate = current.manual_rate;
      if (body.manualRate !== undefined) {
        const parsed = validateManualRate(body.manualRate);
        if (parsed === null) {
          return json(res, 400, { error: 'Manual rate must be between 0.01% and 20%' });
        }
        manualRate = parsed;
      } else if (manualEnabled) {
        manualRate = parseManualRate(current.manual_rate);
        if (manualRate === null) {
          return json(res, 400, { error: 'Manual rate is required when manual mode is enabled' });
        }
      }

      if (manualEnabled && manualRate === null) {
        return json(res, 400, { error: 'Manual rate is required when manual mode is enabled' });
      }

      await saveSettings({
        manual_enabled: manualEnabled,
        manual_rate: manualRate,
      });

      const view = await getCalculatorRateSettingsView();
      return json(res, 200, view);
    } catch (err) {
      const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
      return json(res, status, { error: err.message || 'Failed to save calculator rate settings' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH');
  return json(res, 405, { error: 'Method not allowed' });
};
