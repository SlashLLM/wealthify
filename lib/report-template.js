const { computeRefinance, amortSeries } = require('./refinance-calc');

// ── Placeholder adviser details — replace with real data (per-lead
// assigned adviser, or a config/env value) before shipping. ──
const ADVISER = {
  name: 'Liam Carter',
  fsp: 'FSP123456',
  email: 'liam@wealthify.co.nz',
  phone: '021 555 0199',
  initials: 'LC',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtMoney(n) {
  const v = Math.round(Math.abs(Number(n) || 0));
  return '$' + v.toLocaleString('en-NZ');
}

function fmtMoneyK(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return '$' + Math.round(v / 1000) + 'k';
  return fmtMoney(v);
}

function fmtDateNZ(d) {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function logoSvg(id, w, h) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 34 26" fill="none">
    <defs><linearGradient id="${id}" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#16C172"/><stop offset="100%" stop-color="#0FB5BA"/></linearGradient></defs>
    <rect x="0" y="13" width="5" height="13" rx="1.5" fill="url(#${id})"/>
    <rect x="7" y="6" width="5" height="20" rx="1.5" fill="url(#${id})"/>
    <rect x="14.5" y="9" width="5" height="17" rx="1.5" fill="url(#${id})"/>
    <rect x="22" y="2" width="5" height="24" rx="1.5" fill="url(#${id})"/>
    <rect x="29" y="0" width="5" height="26" rx="1.5" fill="url(#${id})"/>
  </svg>`;
}

function renderReportHtml(lead) {
  const calc = computeRefinance(lead);
  const years = calc.years_remaining;

  const curSeries = amortSeries(calc.loan_balance, calc.current_rate, years);
  const newSeries = amortSeries(calc.loan_balance, calc.target_new_rate, years);

  // Chart geometry — mirrors Refinance-Report.dc.html exactly.
  const chartW = 620, chartH = 230, padL = 56, padR = 12, padT = 14, padB = 30;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;
  const maxVal = Math.max(50000, Math.ceil(curSeries.totalInterest / 50000) * 50000);
  const sx = (yr) => padL + (yr / years) * plotW;
  const sy = (val) => padT + plotH - (val / maxVal) * plotH;

  const curPoly = curSeries.points.map((p) => sx(p.year).toFixed(1) + ',' + sy(p.cum).toFixed(1)).join(' ');
  const newPoly = newSeries.points.map((p) => sx(p.year).toFixed(1) + ',' + sy(p.cum).toFixed(1)).join(' ');
  const curForward = curSeries.points.map((p) => sx(p.year).toFixed(1) + ',' + sy(p.cum).toFixed(1));
  const newBackward = [...newSeries.points].reverse().map((p) => sx(p.year).toFixed(1) + ',' + sy(p.cum).toFixed(1));
  const areaPath = 'M ' + curForward.join(' L ') + ' L ' + newBackward.join(' L ') + ' Z';

  const yGrid = [0, 1, 2, 3, 4].map((i) => {
    const v = (maxVal * i) / 4;
    return { y: sy(v).toFixed(1), label: fmtMoneyK(v) };
  });
  const xGrid = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((f) => ({
    x: sx(f * years).toFixed(1),
    label: 'Yr ' + Math.round(f * years),
  }));

  const barMaxH = 120;
  const barMaxVal = Math.max(curSeries.payment, newSeries.payment);
  const curBarH = Math.max(4, Math.round((curSeries.payment / barMaxVal) * barMaxH));
  const newBarH = Math.max(4, Math.round((newSeries.payment / barMaxVal) * barMaxH));

  const monthlySavingFmt = fmtMoney(calc.monthly_saving) + '/mo';
  const netYear1Fmt = (calc.net_year1 >= 0 ? '' : '-') + fmtMoney(Math.abs(calc.net_year1));
  const annualSavingFmt = fmtMoney(calc.monthly_saving * 12);

  const clientEmail = esc(lead.email || '—');
  const propertyLine = lead.property_address
    ? `<div style="display:flex;gap:40px;margin-top:22px">
        <div>
          <div style="font-size:10.5px;color:rgba(255,255,255,0.38);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Property</div>
          <div style="font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.85)">${esc(lead.property_address)}</div>
        </div>
        <div>
          <div style="font-size:10.5px;color:rgba(255,255,255,0.38);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Prepared</div>
          <div style="font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.85)">${fmtDateNZ(lead.created_at)}</div>
        </div>
      </div>`
    : `<div style="margin-top:22px">
        <div style="font-size:10.5px;color:rgba(255,255,255,0.38);margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Prepared</div>
        <div style="font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.85)">${fmtDateNZ(lead.created_at)}</div>
      </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;font-family:'Plus Jakarta Sans',sans-serif;color:#0B1F3A;background:white}
  .report-page{width:794px;height:1123px;position:relative;background:white}
  .report-page:not(:last-child){break-after:page}
  @page{size:210mm 297mm;margin:0}
</style>
</head>
<body>

<!-- PAGE 1 — COVER -->
<div class="report-page" style="background:#071929;overflow:hidden;display:flex;flex-direction:column">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 45% at 50% 0%,rgba(22,193,114,0.1) 0%,transparent 70%)"></div>
  <div style="position:relative;padding:56px 64px 0;display:flex;align-items:center;justify-content:space-between">
    <div style="display:flex;align-items:center;gap:10px">
      ${logoSvg('cvlg', 34, 27)}
      <span style="font-size:20px;font-weight:800;color:white;letter-spacing:-0.5px">Wealthify</span>
    </div>
    <div style="display:flex;align-items:center;gap:6px;padding:6px 13px;background:rgba(22,193,114,0.12);border:1px solid rgba(22,193,114,0.22);border-radius:100px">
      <span style="font-size:10.5px;font-weight:700;color:#16C172;letter-spacing:.05em">FAP Licensed</span>
    </div>
  </div>
  <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 64px">
    <div style="font-size:12.5px;font-weight:700;color:#16C172;letter-spacing:.1em;text-transform:uppercase;margin-bottom:20px">Personalised Refinance Report</div>
    <h1 style="font-size:52px;font-weight:800;color:white;line-height:1.08;letter-spacing:-2px;margin:0 0 30px">Your path to a<br>cheaper mortgage.</h1>
    <div>
      <div style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:5px">Prepared exclusively for</div>
      <div style="font-size:18px;font-weight:700;color:white">${clientEmail}</div>
    </div>
    ${propertyLine}
  </div>
  <div style="position:relative;margin:0 64px 56px;background:white;border-radius:16px;padding:24px 28px;box-shadow:0 24px 60px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:10.5px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">What's inside</div>
      <div style="font-size:14px;font-weight:600;color:#0B1F3A">Your full savings breakdown &amp; next steps</div>
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px">
      <div style="font-size:30px;font-weight:800;color:#16C172;letter-spacing:-1.5px;line-height:1">${monthlySavingFmt}</div>
      <div style="font-size:11px;color:#8B9AAD;margin-top:4px">estimated saving</div>
    </div>
  </div>
</div>

<!-- PAGE 2 — EXECUTIVE SUMMARY -->
<div class="report-page" style="padding:56px 64px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px">
    <div style="display:flex;align-items:center;gap:8px">${logoSvg('p2lg', 20, 16)}<span style="font-size:13px;font-weight:800;color:#0B1F3A">Wealthify</span></div>
    <span style="font-size:11px;color:#B0BAC5;font-weight:600">Page 2 of 4</span>
  </div>
  <div style="font-size:11px;font-weight:700;color:#16C172;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Executive Summary</div>
  <h2 style="font-size:27px;font-weight:800;color:#0B1F3A;letter-spacing:-0.8px;margin:0 0 14px">Here's what refinancing means for you</h2>
  <p style="font-size:13.5px;color:#5B6B82;line-height:1.65;max-width:620px;margin:0 0 24px">Based on your current mortgage of ${fmtMoney(calc.loan_balance)} at ${calc.current_rate.toFixed(2)}%, we compared over 20 lenders and found a rate that could save you real money — starting from your very next payment.</p>

  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;background:#F6F8FB;border:1px solid #E4E9F0;border-radius:14px;padding:20px 24px;margin-bottom:20px">
    <div>
      <div style="font-size:10px;font-weight:700;color:#B0BAC5;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Your current rate</div>
      <div style="font-size:32px;font-weight:800;color:#C4CDD6;letter-spacing:-1.5px;line-height:1">${calc.current_rate.toFixed(2)}%</div>
      <div style="font-size:12px;color:#8B9AAD;margin-top:6px">${fmtMoney(calc.monthly_payment_current)}/mo</div>
    </div>
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none"><path d="M2 10 H18 M12 4 L18 10 L12 16" stroke="#16C172" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div>
      <div style="font-size:10px;font-weight:700;color:#0E9E5C;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Your new rate</div>
      <div style="font-size:32px;font-weight:800;color:#16C172;letter-spacing:-1.5px;line-height:1">${calc.target_new_rate.toFixed(2)}%</div>
      <div style="font-size:12px;color:#5B6B82;margin-top:6px">${fmtMoney(calc.monthly_payment_new)}/mo</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
    <div style="background:white;border:1px solid #E4E9F0;border-radius:12px;padding:16px">
      <div style="font-size:9.5px;font-weight:700;color:#B0BAC5;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Monthly saving</div>
      <div style="font-size:19px;font-weight:800;color:#16C172;letter-spacing:-0.8px">${monthlySavingFmt}</div>
    </div>
    <div style="background:white;border:1px solid #E4E9F0;border-radius:12px;padding:16px">
      <div style="font-size:9.5px;font-weight:700;color:#B0BAC5;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Interest saved</div>
      <div style="font-size:19px;font-weight:800;color:#16C172;letter-spacing:-0.8px">${fmtMoney(calc.interest_saved)}</div>
    </div>
    <div style="background:white;border:1px solid #E4E9F0;border-radius:12px;padding:16px">
      <div style="font-size:9.5px;font-weight:700;color:#B0BAC5;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Cashback offered</div>
      <div style="font-size:19px;font-weight:800;color:#C9A227;letter-spacing:-0.8px">${fmtMoney(calc.cashback)}</div>
    </div>
    <div style="background:#0B1F3A;border-radius:12px;padding:16px">
      <div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Net benefit yr 1</div>
      <div style="font-size:19px;font-weight:800;color:#16C172;letter-spacing:-0.8px">${netYear1Fmt}</div>
    </div>
  </div>

  <div style="border:1px solid #E4E9F0;border-radius:14px;padding:20px 24px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div style="font-size:13.5px;font-weight:800;color:#0B1F3A">Interest paid over time</div>
      <div style="display:flex;gap:14px">
        <div style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:#C4CDD6;display:inline-block"></span><span style="font-size:10px;color:#8B9AAD;font-weight:600">Stay with current bank</span></div>
        <div style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:#16C172;display:inline-block"></span><span style="font-size:10px;color:#8B9AAD;font-weight:600">Refinance with Wealthify</span></div>
      </div>
    </div>
    <svg width="${chartW}" height="${chartH}" viewBox="0 0 ${chartW} ${chartH}" style="display:block;margin:0 auto">
      ${yGrid.map((g) => `<line x1="56" x2="608" y1="${g.y}" y2="${g.y}" stroke="#F0F3F8" stroke-width="1"/><text x="4" y="${g.y}" font-size="9.5" fill="#B0BAC5" dy="3">${g.label}</text>`).join('')}
      <path d="${areaPath}" fill="#16C172" fill-opacity="0.12"/>
      <polyline points="${curPoly}" fill="none" stroke="#C4CDD6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <polyline points="${newPoly}" fill="none" stroke="#16C172" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      ${xGrid.map((g) => `<text x="${g.x}" y="222" font-size="9.5" fill="#B0BAC5" text-anchor="middle">${g.label}</text>`).join('')}
    </svg>
    <p style="font-size:11px;color:#8B9AAD;text-align:center;margin:4px 0 6px">Shaded area represents total interest saved by refinancing — ${fmtMoney(calc.interest_saved)} over the remaining term.</p>
  </div>

  <div style="position:absolute;left:64px;right:64px;bottom:40px;padding-top:12px;border-top:1px solid #F0F3F8;display:flex;justify-content:space-between">
    <span style="font-size:9.5px;color:#C4CDD6">Estimate only, not financial advice.</span>
    <span style="font-size:9.5px;color:#C4CDD6">Wealthify · FAP Licensed</span>
  </div>
</div>

<!-- PAGE 3 — DETAILED BREAKDOWN -->
<div class="report-page" style="padding:56px 64px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px">
    <div style="display:flex;align-items:center;gap:8px">${logoSvg('p3lg', 20, 16)}<span style="font-size:13px;font-weight:800;color:#0B1F3A">Wealthify</span></div>
    <span style="font-size:11px;color:#B0BAC5;font-weight:600">Page 3 of 4</span>
  </div>
  <div style="font-size:11px;font-weight:700;color:#16C172;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Detailed Breakdown</div>
  <h2 style="font-size:27px;font-weight:800;color:#0B1F3A;letter-spacing:-0.8px;margin:0 0 24px">The numbers, in detail</h2>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:26px">
    <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Loan balance</div>
      <div style="font-size:16px;font-weight:800;color:#0B1F3A">${fmtMoney(calc.loan_balance)}</div>
    </div>
    <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Term remaining</div>
      <div style="font-size:16px;font-weight:800;color:#0B1F3A">${years} yrs</div>
    </div>
    <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Current rate</div>
      <div style="font-size:16px;font-weight:800;color:#0B1F3A">${calc.current_rate.toFixed(2)}%</div>
    </div>
    <div style="background:rgba(22,193,114,0.06);border:1px solid rgba(22,193,114,0.18);border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#0E9E5C;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">New rate</div>
      <div style="font-size:16px;font-weight:800;color:#0E9E5C">${calc.target_new_rate.toFixed(2)}%</div>
    </div>
  </div>

  <div style="border:1px solid #E4E9F0;border-radius:14px;padding:20px 24px;margin-bottom:20px">
    <div style="font-size:13.5px;font-weight:800;color:#0B1F3A;margin-bottom:16px">Monthly payment comparison</div>
    <div style="display:flex;align-items:flex-end;gap:44px;height:150px;padding:0 16px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="font-size:14px;font-weight:800;color:#5B6B82">${fmtMoney(calc.monthly_payment_current)}/mo</div>
        <div style="width:60px;height:${curBarH}px;background:#E4E9F0;border-radius:8px 8px 0 0"></div>
        <div style="font-size:11px;color:#8B9AAD;font-weight:600">Current bank</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="font-size:14px;font-weight:800;color:#0E9E5C">${fmtMoney(calc.monthly_payment_new)}/mo</div>
        <div style="width:60px;height:${newBarH}px;background:linear-gradient(180deg,#16C172,#0E9E5C);border-radius:8px 8px 0 0"></div>
        <div style="font-size:11px;color:#8B9AAD;font-weight:600">Wealthify rate</div>
      </div>
      <div style="margin-left:auto;align-self:center;background:rgba(22,193,114,0.08);border:1px solid rgba(22,193,114,0.18);border-radius:10px;padding:12px 20px;text-align:center">
        <div style="font-size:9.5px;font-weight:700;color:#0E9E5C;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">You save</div>
        <div style="font-size:19px;font-weight:800;color:#0E9E5C;letter-spacing:-0.5px">${monthlySavingFmt}</div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px">
    <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Break fee</div>
      <div style="font-size:16px;font-weight:800;color:#0B1F3A">${fmtMoney(calc.break_fee)}</div>
    </div>
    <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Legal costs</div>
      <div style="font-size:16px;font-weight:800;color:#0B1F3A">${fmtMoney(calc.legal_costs)}</div>
    </div>
    <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:14px">
      <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Total switch cost</div>
      <div style="font-size:16px;font-weight:800;color:#0B1F3A">${fmtMoney(calc.switch_cost)}</div>
    </div>
  </div>

  <div style="border:1px solid #E4E9F0;border-radius:14px;padding:20px 24px">
    <div style="font-size:13.5px;font-weight:800;color:#0B1F3A;margin-bottom:16px">How we calculate your Year 1 net benefit</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap">
      <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:12px 16px;min-width:126px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Saving × 12mo</div>
        <div style="font-size:15px;font-weight:800;color:#0B1F3A">${annualSavingFmt}</div>
      </div>
      <span style="font-size:18px;font-weight:700;color:#C4CDD6">+</span>
      <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:12px 16px;min-width:126px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Cashback</div>
        <div style="font-size:15px;font-weight:800;color:#C9A227">${fmtMoney(calc.cashback)}</div>
      </div>
      <span style="font-size:18px;font-weight:700;color:#C4CDD6">−</span>
      <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:10px;padding:12px 16px;min-width:126px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Switch costs</div>
        <div style="font-size:15px;font-weight:800;color:#0B1F3A">${fmtMoney(calc.switch_cost)}</div>
      </div>
      <span style="font-size:18px;font-weight:700;color:#C4CDD6">=</span>
      <div style="background:#0B1F3A;border-radius:10px;padding:12px 22px;min-width:146px;text-align:center">
        <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Net benefit Yr 1</div>
        <div style="font-size:17px;font-weight:800;color:#16C172">${netYear1Fmt}</div>
      </div>
    </div>
  </div>

  <div style="position:absolute;left:64px;right:64px;bottom:40px;padding-top:12px;border-top:1px solid #F0F3F8;display:flex;justify-content:space-between">
    <span style="font-size:9.5px;color:#C4CDD6">Figures based on standard NZ amortisation and current market rates.</span>
    <span style="font-size:9.5px;color:#C4CDD6">Wealthify · FAP Licensed</span>
  </div>
</div>

<!-- PAGE 4 — NEXT STEPS -->
<div class="report-page" style="padding:56px 64px">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:26px">
    <div style="display:flex;align-items:center;gap:8px">${logoSvg('p4lg', 20, 16)}<span style="font-size:13px;font-weight:800;color:#0B1F3A">Wealthify</span></div>
    <span style="font-size:11px;color:#B0BAC5;font-weight:600">Page 4 of 4</span>
  </div>
  <div style="font-size:11px;font-weight:700;color:#16C172;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Next Steps</div>
  <h2 style="font-size:27px;font-weight:800;color:#0B1F3A;letter-spacing:-0.8px;margin:0 0 24px">From report to refinanced, in three steps</h2>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:28px">
    <div style="border:1px solid #E4E9F0;border-radius:12px;padding:18px">
      <div style="width:30px;height:30px;border-radius:8px;background:rgba(22,193,114,0.1);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#16C172;margin-bottom:12px">1</div>
      <div style="font-size:13.5px;font-weight:800;color:#0B1F3A;margin-bottom:6px">We confirm your rate</div>
      <div style="font-size:12px;color:#8B9AAD;line-height:1.55">Your adviser locks in the numbers above with the lender and confirms eligibility.</div>
    </div>
    <div style="border:1px solid #E4E9F0;border-radius:12px;padding:18px">
      <div style="width:30px;height:30px;border-radius:8px;background:rgba(22,193,114,0.1);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#16C172;margin-bottom:12px">2</div>
      <div style="font-size:13.5px;font-weight:800;color:#0B1F3A;margin-bottom:6px">We handle the paperwork</div>
      <div style="font-size:12px;color:#8B9AAD;line-height:1.55">We manage the application, valuation and lender negotiation end-to-end.</div>
    </div>
    <div style="border:1px solid #E4E9F0;border-radius:12px;padding:18px">
      <div style="width:30px;height:30px;border-radius:8px;background:rgba(22,193,114,0.1);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#16C172;margin-bottom:12px">3</div>
      <div style="font-size:13.5px;font-weight:800;color:#0B1F3A;margin-bottom:6px">You start saving</div>
      <div style="font-size:12px;color:#8B9AAD;line-height:1.55">Your new rate takes effect at settlement — ${monthlySavingFmt} back in your pocket, every month.</div>
    </div>
  </div>

  <div style="background:#071929;border-radius:16px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;margin-bottom:26px">
    <div style="display:flex;align-items:center;gap:16px">
      <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:#16C172;flex-shrink:0">${esc(ADVISER.initials)}</div>
      <div>
        <div style="font-size:15px;font-weight:800;color:white;margin-bottom:3px">${esc(ADVISER.name)}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45)">Your licensed mortgage adviser · ${esc(ADVISER.fsp)}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:12.5px;font-weight:600;color:white">${esc(ADVISER.email)}</div>
      <div style="font-size:12.5px;color:rgba(255,255,255,0.5);margin-top:3px">${esc(ADVISER.phone)}</div>
    </div>
  </div>

  <div style="background:#F6F8FB;border:1px solid #E4E9F0;border-radius:12px;padding:20px 22px;margin-bottom:20px">
    <div style="font-size:11px;font-weight:800;color:#5B6B82;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Important information</div>
    <p style="font-size:10.5px;color:#8B9AAD;line-height:1.7;margin:0">This report is an estimate only and does not constitute financial advice. Figures are based on standard New Zealand amortisation methodology and indicative market rates as at the date this report was prepared, and may change based on lender assessment, your individual circumstances, and final valuation. Cashback contributions are subject to lender terms and may be subject to pro-rata clawback if you repay or switch lenders within the offer's minimum term. Wealthify Limited is a licensed Financial Advice Provider (FAP) under the Financial Markets Conduct Act 2013. Your personalised numbers will be confirmed in writing by a licensed adviser before you make any decision to refinance.</p>
  </div>

  <div style="position:absolute;left:64px;right:64px;bottom:48px;display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid #F0F3F8">
    <div style="display:flex;align-items:center;gap:7px">${logoSvg('p4fl', 16, 12)}<span style="font-size:11px;font-weight:700;color:#0B1F3A">Wealthify</span></div>
    <span style="font-size:9.5px;color:#C4CDD6">Licensed FAP · Estimates only, not financial advice</span>
  </div>
</div>

</body>
</html>`;
}

module.exports = { renderReportHtml };
