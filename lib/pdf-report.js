const path = require('path');
const PDFDocument = require('pdfkit');
const { computeRefinance, amortSeries } = require('./refinance-calc');

// ─────────────────────────────────────────────────────────────
// Brand system — lifted directly from the Wealthify landing page
// (index.html). Colours, typography and motifs match 1:1 so the
// report reads as a first-party brand artefact.
// ─────────────────────────────────────────────────────────────
const C = {
  heroNavy: '#071929',
  navy: '#0B1F3A',
  navyDepth: '#162D5A',
  ink: '#1A2433',
  body: '#5B6B82',
  muted: '#8B9AAD',
  muted2: '#B0BAC5',
  muted3: '#C4CDD6',
  green: '#16C172',
  greenDark: '#0E9E5C',
  teal: '#0FB5BA',
  gold: '#E8B04B',
  warn: '#FF6B6B',
  surface: '#F6F8FB',
  border: '#E4E9F0',
  hairline: '#F0F3F7',
  white: '#FFFFFF',
};

const FONT_DIR = path.join(__dirname, 'fonts');
const F = {
  reg: 'PJS-Regular',
  med: 'PJS-Medium',
  semi: 'PJS-SemiBold',
  bold: 'PJS-Bold',
  black: 'PJS-ExtraBold',
};

const ADVISER = {
  name: 'Liam Carter',
  fsp: 'FSP123456',
  email: 'liam@wealthify.co.nz',
  phone: '021 555 0199',
  initials: 'LC',
};

// A4 geometry
const PW = 595.28;
const PH = 841.89;
const M = 48;
const CW = PW - M * 2;

// ── formatters ────────────────────────────────────────────────
function moneyNZ(n) {
  const v = Math.round(Math.abs(Number(n) || 0));
  return '$' + v.toLocaleString('en-NZ');
}
function moneyKNZ(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000) return '$' + Math.round(v / 1000) + 'k';
  return moneyNZ(v);
}
function signedMoney(n) {
  return (Number(n) < 0 ? '-' : '') + moneyNZ(n);
}
function pct(n) {
  return (Number(n) || 0).toFixed(2) + '%';
}
function dateNZ(d) {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── low-level helpers ─────────────────────────────────────────
function registerFonts(doc) {
  doc.registerFont(F.reg, path.join(FONT_DIR, 'PlusJakartaSans-Regular.ttf'));
  doc.registerFont(F.med, path.join(FONT_DIR, 'PlusJakartaSans-Medium.ttf'));
  doc.registerFont(F.semi, path.join(FONT_DIR, 'PlusJakartaSans-SemiBold.ttf'));
  doc.registerFont(F.bold, path.join(FONT_DIR, 'PlusJakartaSans-Bold.ttf'));
  doc.registerFont(F.black, path.join(FONT_DIR, 'PlusJakartaSans-ExtraBold.ttf'));
}

function brandGrad(doc, x0, y0, x1, y1) {
  return doc.linearGradient(x0, y0, x1, y1).stop(0, C.green).stop(1, C.teal);
}
function navyGrad(doc, x0, y0, x1, y1) {
  return doc.linearGradient(x0, y0, x1, y1).stop(0, C.navy).stop(1, C.navyDepth);
}

// Wealthify 5-bar mark (SVG viewBox 0 0 34 26), filled with brand gradient.
function drawLogo(doc, x, y, scale, opts = {}) {
  const bars = [
    [0, 13, 5, 13],
    [7, 6, 5, 20],
    [14.5, 9, 5, 17],
    [22, 2, 5, 24],
    [29, 0, 5, 26],
  ];
  const fill = opts.solid || brandGrad(doc, x, y + 26 * scale, x + 34 * scale, y);
  bars.forEach(([bx, by, bw, bh]) => {
    doc.roundedRect(x + bx * scale, y + by * scale, bw * scale, bh * scale, 1.5 * scale).fill(fill);
  });
  return x + 34 * scale;
}

// Draw an SVG path string at (x,y) with uniform scale — reuses the
// site's own icon path data for pixel-faithful brand icons.
function svgIcon(doc, d, x, y, scale, color, lineWidth) {
  doc.save();
  doc.translate(x, y).scale(scale);
  doc.lineWidth((lineWidth || 1.5) / scale).lineJoin('round').lineCap('round');
  doc.path(d).stroke(color);
  doc.restore();
}

function softShadow(doc, x, y, w, h, r) {
  doc.save();
  doc.fillOpacity(0.06).roundedRect(x + 1.5, y + 4, w, h, r).fill(C.navy);
  doc.fillOpacity(1).restore();
}

function eyebrow(doc, text, x, y, color) {
  doc
    .font(F.bold)
    .fontSize(9.5)
    .fillColor(color || C.green)
    .text(text.toUpperCase(), x, y, { characterSpacing: 0.9 });
}

// Running header + footer chrome on content pages
function chrome(doc, pageNum) {
  const logoEnd = drawLogo(doc, M, M - 4, 0.55);
  doc.font(F.black).fontSize(12).fillColor(C.navy).text('Wealthify', logoEnd + 7, M - 2, { characterSpacing: -0.3 });
  doc
    .font(F.semi)
    .fontSize(10)
    .fillColor(C.muted2)
    .text(`Page ${pageNum} of 5`, M, M - 1, { width: CW, align: 'right' });

  const fy = PH - 46;
  doc.moveTo(M, fy).lineTo(PW - M, fy).lineWidth(1).strokeColor(C.hairline).stroke();
  doc.font(F.med).fontSize(8).fillColor(C.muted3).text('Estimate only — not financial advice.', M, fy + 9);
  doc.font(F.med).fontSize(8).fillColor(C.muted3).text('Wealthify · Licensed NZ FAP', M, fy + 9, { width: CW, align: 'right' });
}

// A stat tile: small uppercase label + big value.
function statTile(doc, x, y, w, h, label, value, opts = {}) {
  const bg = opts.bg || C.white;
  const dark = opts.dark;
  if (dark) {
    doc.roundedRect(x, y, w, h, 12).fill(navyGrad(doc, x, y, x, y + h));
  } else {
    doc.roundedRect(x, y, w, h, 12).fillAndStroke(bg, opts.border || C.border);
  }
  doc
    .font(F.bold)
    .fontSize(8)
    .fillColor(dark ? '#7C8BA5' : (opts.labelColor || C.muted2))
    .text(label.toUpperCase(), x + 14, y + 14, { width: w - 28, characterSpacing: 0.4 });
  doc
    .font(F.black)
    .fontSize(opts.valueSize || 18)
    .fillColor(opts.valueColor || (dark ? C.green : C.navy))
    .text(value, x + 14, y + 30, { width: w - 28, characterSpacing: -0.5 });
  if (opts.sub) {
    doc.font(F.med).fontSize(8.5).fillColor(dark ? '#7C8BA5' : C.muted).text(opts.sub, x + 14, y + h - 20, { width: w - 28 });
  }
}

// ─────────────────────────────────────────────────────────────
// PAGE 1 — COVER
// ─────────────────────────────────────────────────────────────
function coverPage(doc, lead, calc) {
  doc.rect(0, 0, PW, PH).fill(C.heroNavy);
  // soft brand-green glow, top
  doc.save();
  const glow = doc.radialGradient(PW / 2, -40, 0, PW / 2, -40, 420);
  glow.stop(0, C.green).stop(1, C.heroNavy);
  doc.fillOpacity(0.16).rect(0, 0, PW, 360).fill(glow);
  doc.fillOpacity(1).restore();

  // header
  const logoEnd = drawLogo(doc, M, 52, 0.9);
  doc.font(F.black).fontSize(18).fillColor(C.white).text('Wealthify', logoEnd + 9, 55, { characterSpacing: -0.4 });

  const pillW = 108, pillX = PW - M - pillW, pillY = 52;
  doc.save().fillOpacity(0.12).roundedRect(pillX, pillY, pillW, 24, 12).fill(C.green).restore();
  doc.roundedRect(pillX, pillY, pillW, 24, 12).lineWidth(1).strokeOpacity(0.25).stroke(C.green).strokeOpacity(1);
  doc.font(F.bold).fontSize(8.5).fillColor(C.green).text('FAP LICENSED', pillX, pillY + 8, { width: pillW, align: 'center', characterSpacing: 0.6 });

  // headline block
  let y = 300;
  eyebrow(doc, 'Personalised Refinance Report', M, y, C.green);
  y += 26;
  doc.font(F.black).fontSize(46).fillColor(C.white).text('Your path to a', M, y, { characterSpacing: -2, lineGap: 0 });
  y += 52;
  doc.font(F.black).fontSize(46).fillColor(C.white).text('cheaper mortgage.', M, y, { characterSpacing: -2 });

  // meta block
  y += 78;
  doc.font(F.med).fontSize(10.5).fillColor('#7C8BA5').text('Prepared exclusively for', M, y);
  y += 16;
  doc.font(F.bold).fontSize(15);
  const emailH = doc.heightOfString(lead.email || '—', { width: CW });
  doc.fillColor(C.white).text(lead.email || '—', M, y, { width: CW });

  y += emailH + 22;
  const col2 = M + 270;
  doc.font(F.bold).fontSize(8.5).fillColor('#5C6A80').text('PROPERTY', M, y, { characterSpacing: 0.5 });
  doc.font(F.bold).fontSize(8.5).fillColor('#5C6A80').text('PREPARED', col2, y, { characterSpacing: 0.5 });
  y += 14;
  doc.font(F.semi).fontSize(11).fillColor('#D9DEE6').text(lead.property_address || '—', M, y, { width: 250 });
  doc.font(F.semi).fontSize(11).fillColor('#D9DEE6').text(dateNZ(lead.created_at), col2, y, { width: 200 });

  // floating key-figure card
  const cardH = 92, cardY = PH - 150;
  softShadow(doc, M, cardY, CW, cardH, 16);
  doc.roundedRect(M, cardY, CW, cardH, 16).fill(C.white);
  // gradient accent bar on the left edge
  doc.roundedRect(M, cardY, 6, cardH, 3).fill(brandGrad(doc, M, cardY, M, cardY + cardH));
  doc.font(F.bold).fontSize(8.5).fillColor(C.muted).text("WHAT'S INSIDE", M + 26, cardY + 24, { characterSpacing: 0.5 });
  doc.font(F.bold).fontSize(13).fillColor(C.navy).text('Your full savings breakdown & next steps', M + 26, cardY + 40, { width: 280 });

  doc.font(F.med).fontSize(9.5).fillColor(C.muted).text('Estimated monthly saving', M, cardY + 26, { width: CW - 28, align: 'right' });
  doc.font(F.black).fontSize(30).fillColor(C.green).text(moneyNZ(calc.monthly_saving) + '/mo', M, cardY + 44, { width: CW - 28, align: 'right', characterSpacing: -1 });
}

// ─────────────────────────────────────────────────────────────
// PAGE 2 — SAVINGS AT A GLANCE
// ─────────────────────────────────────────────────────────────
function summaryPage(doc, lead, calc) {
  chrome(doc, 2);
  let y = M + 40;
  eyebrow(doc, 'Executive Summary', M, y);
  y += 18;
  doc.font(F.black).fontSize(23).fillColor(C.navy).text("Here's what refinancing means for you", M, y, { width: CW, characterSpacing: -0.5 });
  y += 34;
  doc
    .font(F.med)
    .fontSize(10.5)
    .fillColor(C.body)
    .text(
      `Based on your current mortgage of ${moneyNZ(calc.loan_balance)} at ${pct(calc.current_rate)}, we compared over 20 NZ lenders and found a rate that could save you real money — starting from your very next payment.`,
      M,
      y,
      { width: CW - 40, lineGap: 3 }
    );
  y += 52;

  // Signature rate-transition card (grey current → green new)
  const rtH = 96;
  doc.roundedRect(M, y, CW, rtH, 14).fillAndStroke(C.surface, C.border);
  const half = CW / 2;
  // current
  doc.font(F.bold).fontSize(8.5).fillColor(C.muted2).text('YOUR CURRENT RATE', M + 24, y + 18, { characterSpacing: 0.5 });
  doc.font(F.black).fontSize(34).fillColor(C.muted3).text(pct(calc.current_rate), M + 24, y + 34, { characterSpacing: -1.5 });
  doc.font(F.semi).fontSize(9.5).fillColor(C.muted).text(moneyNZ(calc.monthly_payment_current) + '/mo', M + 24, y + rtH - 22);
  // arrow
  svgIcon(doc, 'M2 10 H18 M12 4 L18 10 L12 16', M + half - 11, y + rtH / 2 - 10, 1.0, C.green, 1.8);
  // new
  const nx = M + half + 24;
  doc.font(F.bold).fontSize(8.5).fillColor(C.greenDark).text('YOUR NEW RATE', nx, y + 18, { characterSpacing: 0.5 });
  doc.font(F.black).fontSize(34).fillColor(C.green).text(pct(calc.target_new_rate), nx, y + 34, { characterSpacing: -1.5 });
  doc.font(F.semi).fontSize(9.5).fillColor(C.body).text(moneyNZ(calc.monthly_payment_new) + '/mo', nx, y + rtH - 22);
  y += rtH + 16;

  // 4 stat tiles
  const gap = 12;
  const tw = (CW - gap * 3) / 4;
  const th = 62;
  statTile(doc, M, y, tw, th, 'Monthly saving', moneyNZ(calc.monthly_saving) + '/mo', { valueColor: C.green, valueSize: 16 });
  statTile(doc, M + (tw + gap), y, tw, th, 'Interest saved', moneyNZ(calc.interest_saved), { valueColor: C.green, valueSize: 16 });
  statTile(doc, M + (tw + gap) * 2, y, tw, th, 'Cashback', moneyNZ(calc.cashback), { valueColor: C.gold, valueSize: 16 });
  statTile(doc, M + (tw + gap) * 3, y, tw, th, 'Net benefit yr 1', signedMoney(calc.net_year1), { dark: true, valueSize: 16, valueColor: calc.net_year1 >= 0 ? C.green : C.warn });
  y += th + 20;

  // interest-over-time chart
  const chH = 230;
  doc.roundedRect(M, y, CW, chH, 14).lineWidth(1).stroke(C.border);
  doc.font(F.bold).fontSize(12).fillColor(C.navy).text('Interest paid over time', M + 22, y + 18);
  // legend
  const lgY = y + 20;
  doc.roundedRect(M + CW - 210, lgY, 7, 7, 1.5).fill(C.muted3);
  doc.font(F.med).fontSize(8.5).fillColor(C.muted).text('Stay with current bank', M + CW - 199, lgY - 1);
  doc.roundedRect(M + CW - 78, lgY, 7, 7, 1.5).fill(C.green);
  doc.font(F.med).fontSize(8.5).fillColor(C.muted).text('Refinance', M + CW - 67, lgY - 1);

  const years = calc.years_remaining;
  const cur = amortSeries(calc.loan_balance, calc.current_rate, years);
  const neu = amortSeries(calc.loan_balance, calc.target_new_rate, years);
  drawAreaChart(doc, M + 12, y + 44, CW - 24, chH - 76, cur, neu, years);
  doc
    .font(F.med)
    .fontSize(8.5)
    .fillColor(C.muted)
    .text(`Shaded area represents total interest saved by refinancing — ${moneyNZ(calc.interest_saved)} over the remaining term.`, M + 22, y + chH - 22, { width: CW - 44, align: 'center' });
}

function drawAreaChart(doc, x, y, w, h, cur, neu, years) {
  const padL = 38, padR = 8, padT = 6, padB = 20;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  const maxVal = Math.max(50000, Math.ceil(cur.totalInterest / 50000) * 50000);
  const sx = (yr) => x + padL + (yr / years) * pw;
  const sy = (v) => y + padT + ph - (v / maxVal) * ph;

  // grid + y labels
  for (let i = 0; i <= 4; i++) {
    const v = (maxVal * i) / 4;
    const gy = sy(v);
    doc.moveTo(x + padL, gy).lineTo(x + w - padR, gy).lineWidth(1).strokeColor(C.hairline).stroke();
    doc.font(F.med).fontSize(8).fillColor(C.muted2).text(moneyKNZ(v), x, gy - 4, { width: padL - 6, align: 'right' });
  }
  // shaded saving area (between curves)
  doc.save();
  doc.moveTo(sx(cur.points[0].year), sy(cur.points[0].cum));
  cur.points.forEach((p) => doc.lineTo(sx(p.year), sy(p.cum)));
  [...neu.points].reverse().forEach((p) => doc.lineTo(sx(p.year), sy(p.cum)));
  doc.closePath().fillOpacity(0.12).fill(C.green);
  doc.fillOpacity(1).restore();
  // current line
  doc.moveTo(sx(cur.points[0].year), sy(cur.points[0].cum));
  cur.points.forEach((p) => doc.lineTo(sx(p.year), sy(p.cum)));
  doc.lineWidth(2.5).lineJoin('round').strokeColor(C.muted3).stroke();
  // new line (brand gradient)
  doc.moveTo(sx(neu.points[0].year), sy(neu.points[0].cum));
  neu.points.forEach((p) => doc.lineTo(sx(p.year), sy(p.cum)));
  doc.lineWidth(2.5).lineJoin('round').strokeColor(brandGrad(doc, x, y, x + w, y)).stroke();
  // x labels
  [0, 0.2, 0.4, 0.6, 0.8, 1].forEach((f) => {
    const gx = sx(f * years);
    doc.font(F.med).fontSize(8).fillColor(C.muted2).text('Yr ' + Math.round(f * years), gx - 14, y + h - 13, { width: 28, align: 'center' });
  });
}

// ─────────────────────────────────────────────────────────────
// PAGE 3 — THE NUMBERS, IN DETAIL
// ─────────────────────────────────────────────────────────────
function breakdownPage(doc, lead, calc) {
  chrome(doc, 3);
  let y = M + 40;
  eyebrow(doc, 'Detailed Breakdown', M, y);
  y += 18;
  doc.font(F.black).fontSize(23).fillColor(C.navy).text('The numbers, in detail', M, y, { characterSpacing: -0.5 });
  y += 40;

  const years = calc.years_remaining;
  const gap = 12;
  const tw = (CW - gap * 3) / 4;
  statTile(doc, M, y, tw, 56, 'Loan balance', moneyNZ(calc.loan_balance), { bg: C.surface, valueSize: 15 });
  statTile(doc, M + (tw + gap), y, tw, 56, 'Term remaining', `${years} yrs`, { bg: C.surface, valueSize: 15 });
  statTile(doc, M + (tw + gap) * 2, y, tw, 56, 'Current rate', pct(calc.current_rate), { bg: C.surface, valueSize: 15 });
  statTile(doc, M + (tw + gap) * 3, y, tw, 56, 'New rate', pct(calc.target_new_rate), { bg: '#EFFAF4', border: '#B9EBD2', labelColor: C.greenDark, valueColor: C.greenDark, valueSize: 15 });
  y += 76;

  // monthly payment comparison
  const cmpH = 158;
  doc.roundedRect(M, y, CW, cmpH, 14).lineWidth(1).stroke(C.border);
  doc.font(F.bold).fontSize(12).fillColor(C.navy).text('Monthly payment comparison', M + 22, y + 18);

  const barMaxH = 78;
  const bmv = Math.max(calc.monthly_payment_current, calc.monthly_payment_new, 1);
  const curBarH = Math.max(6, Math.round((calc.monthly_payment_current / bmv) * barMaxH));
  const newBarH = Math.max(6, Math.round((calc.monthly_payment_new / bmv) * barMaxH));
  const baseY = y + cmpH - 28;
  const b1 = M + 66, b2 = M + 168, bw = 46;

  doc.font(F.bold).fontSize(10).fillColor(C.body).text(moneyNZ(calc.monthly_payment_current) + '/mo', b1 - 22, baseY - curBarH - 16, { width: 90, align: 'center' });
  doc.roundedRect(b1, baseY - curBarH, bw, curBarH, 6).fill(C.border);
  doc.font(F.semi).fontSize(8.5).fillColor(C.muted).text('Current bank', b1 - 22, baseY + 8, { width: 90, align: 'center' });

  doc.font(F.bold).fontSize(10).fillColor(C.greenDark).text(moneyNZ(calc.monthly_payment_new) + '/mo', b2 - 22, baseY - newBarH - 16, { width: 90, align: 'center' });
  doc.roundedRect(b2, baseY - newBarH, bw, newBarH, 6).fill(brandGrad(doc, b2, baseY, b2, baseY - newBarH));
  doc.font(F.semi).fontSize(8.5).fillColor(C.muted).text('Wealthify rate', b2 - 22, baseY + 8, { width: 90, align: 'center' });

  const sbW = 150, sbX = M + CW - sbW - 22, sbY = y + 44;
  doc.save().fillOpacity(0.07).roundedRect(sbX, sbY, sbW, 70, 12).fill(C.green).restore();
  doc.roundedRect(sbX, sbY, sbW, 70, 12).lineWidth(1).strokeOpacity(0.3).stroke(C.green).strokeOpacity(1);
  doc.font(F.bold).fontSize(8.5).fillColor(C.greenDark).text('YOU SAVE', sbX, sbY + 16, { width: sbW, align: 'center', characterSpacing: 0.5 });
  doc.font(F.black).fontSize(20).fillColor(C.greenDark).text(moneyNZ(calc.monthly_saving) + '/mo', sbX, sbY + 34, { width: sbW, align: 'center', characterSpacing: -0.5 });
  y += cmpH + 18;

  // switch cost tiles
  const cw3 = (CW - gap * 2) / 3;
  statTile(doc, M, y, cw3, 56, 'Break fee', moneyNZ(calc.break_fee), { bg: C.surface, valueSize: 15 });
  statTile(doc, M + (cw3 + gap), y, cw3, 56, 'Legal costs', moneyNZ(calc.legal_costs), { bg: C.surface, valueSize: 15 });
  statTile(doc, M + (cw3 + gap) * 2, y, cw3, 56, 'Total switch cost', moneyNZ(calc.switch_cost), { bg: C.surface, valueSize: 15 });
  y += 76;

  // net benefit equation
  const eqH = 104;
  doc.roundedRect(M, y, CW, eqH, 14).lineWidth(1).stroke(C.border);
  doc.font(F.bold).fontSize(12).fillColor(C.navy).text('How we calculate your Year 1 net benefit', M + 22, y + 18);

  const chipW = 98, chipH = 48, chipY = y + 42;
  const parts = [
    { label: 'SAVING × 12MO', val: moneyNZ(calc.monthly_saving * 12), color: C.navy },
    { op: '+' },
    { label: 'CASHBACK', val: moneyNZ(calc.cashback), color: C.gold },
    { op: '-' },
    { label: 'SWITCH COSTS', val: moneyNZ(calc.switch_cost), color: C.navy },
    { op: '=' },
    { label: 'NET BENEFIT YR 1', val: signedMoney(calc.net_year1), color: calc.net_year1 >= 0 ? C.green : C.warn, dark: true },
  ];
  const opW = 22;
  const totalW = parts.reduce((a, p) => a + (p.op ? opW : chipW), 0);
  let cx = M + (CW - totalW) / 2;
  parts.forEach((p) => {
    if (p.op) {
      doc.font(F.bold).fontSize(15).fillColor(C.muted3).text(p.op, cx, chipY + 15, { width: opW, align: 'center' });
      cx += opW;
      return;
    }
    if (p.dark) {
      doc.roundedRect(cx, chipY, chipW, chipH, 9).fill(navyGrad(doc, cx, chipY, cx, chipY + chipH));
    } else {
      doc.roundedRect(cx, chipY, chipW, chipH, 9).fillAndStroke(C.surface, C.border);
    }
    doc.font(F.bold).fontSize(6.8).fillColor(p.dark ? '#7C8BA5' : C.muted2).text(p.label, cx + 6, chipY + 9, { width: chipW - 12, align: 'center', characterSpacing: 0.3 });
    doc.font(F.black).fontSize(12.5).fillColor(p.color).text(p.val, cx + 6, chipY + 23, { width: chipW - 12, align: 'center', characterSpacing: -0.3 });
    cx += chipW;
  });
}

// ─────────────────────────────────────────────────────────────
// PAGE 4 — WHY WEALTHIFY
// ─────────────────────────────────────────────────────────────
function whyPage(doc, lead, calc) {
  chrome(doc, 4);
  let y = M + 40;
  eyebrow(doc, 'Why Refinance With Us', M, y);
  y += 18;
  doc.font(F.black).fontSize(23).fillColor(C.navy).text("You're not doing this alone", M, y, { characterSpacing: -0.5 });
  y += 34;
  doc
    .font(F.med)
    .fontSize(10.5)
    .fillColor(C.body)
    .text('We’re not a bank. We’re independent, licensed NZ advisers who do the hard work so you don’t have to — comparing 20+ lenders, negotiating hard, and handling every piece of paperwork.', M, y, { width: CW - 40, lineGap: 3 });
  y += 50;

  const tiles = [
    { icon: 'M10 2 L3 5 V10 C3 14 10 18 10 18 C10 18 17 14 17 10 V5 Z M7 10 L9 12 L13 8', color: C.green, title: 'Independent advice', body: 'We work for you, not the banks — always recommending what’s best for your situation.' },
    { icon: 'M3 6 H17 M3 10 H13 M3 14 H10', color: C.teal, title: 'Plain English', body: 'No jargon. We explain everything clearly so you can make confident decisions.' },
    { icon: 'M10 3 C10 3 6 5 4 8 C4 12 7 15 10 17 C13 15 16 12 16 8 C14 5 10 3 10 3 Z M10 7 V11 M10 13.5 V14', color: C.gold, title: 'We do the wrangling', body: 'Paperwork, bank negotiations and follow-ups — all handled. You just say yes.' },
    { icon: 'M10 2 L3 5 V10 C3 14 10 18 10 18 C10 18 17 14 17 10 V5 Z M7 10 L9 12 L13 8', color: C.green, title: 'Free to use', body: 'Our advice is completely free for clients. We’re paid by the lender, not you.' },
  ];
  const gap = 14;
  const tw = (CW - gap) / 2;
  const th = 96;
  tiles.forEach((t, i) => {
    const tx = M + (i % 2) * (tw + gap);
    const ty = y + Math.floor(i / 2) * (th + gap);
    doc.roundedRect(tx, ty, tw, th, 14).fillAndStroke(C.surface, C.border);
    // icon tile
    doc.save().fillOpacity(0.1).roundedRect(tx + 20, ty + 20, 40, 40, 10).fill(t.color).restore();
    svgIcon(doc, t.icon, tx + 30, ty + 30, 1.0, t.color, 1.5);
    doc.font(F.bold).fontSize(13).fillColor(C.navy).text(t.title, tx + 76, ty + 24, { width: tw - 92 });
    doc.font(F.med).fontSize(9.5).fillColor(C.body).text(t.body, tx + 76, ty + 42, { width: tw - 92, lineGap: 2 });
  });
  y += (th + gap) * 2 + 8;

  // market context strip with check-rows
  const stH = 138;
  doc.roundedRect(M, y, CW, stH, 14).fill(navyGrad(doc, M, y, M + CW, y + stH));
  doc.font(F.bold).fontSize(8.5).fillColor(C.green).text('WHAT HAPPENS NEXT', M + 26, y + 22, { characterSpacing: 0.6 });
  doc.font(F.black).fontSize(16).fillColor(C.white).text('Everything below is confirmed by a licensed adviser', M + 26, y + 38, { width: CW - 52, characterSpacing: -0.3 });
  const checks = [
    'A free 30-minute call to confirm your numbers and goals',
    'We search 20+ lenders and structure the best deal for you',
    'We manage the full application, valuation and settlement',
  ];
  let cy2 = y + 74;
  checks.forEach((ck) => {
    doc.save().fillOpacity(0.14).circle(M + 32, cy2 + 6, 9).fill(C.green).restore();
    svgIcon(doc, 'M3 8.5 L6.5 12 L13 4', M + 32 - 5.5, cy2 + 0.5, 0.7, C.green, 2);
    doc.font(F.semi).fontSize(10).fillColor('#D9DEE6').text(ck, M + 50, cy2 + 1, { width: CW - 80 });
    cy2 += 20;
  });
}

// ─────────────────────────────────────────────────────────────
// PAGE 5 — NEXT STEPS
// ─────────────────────────────────────────────────────────────
function nextStepsPage(doc, lead, calc) {
  chrome(doc, 5);
  let y = M + 40;
  eyebrow(doc, 'Next Steps', M, y);
  y += 18;
  doc.font(F.black).fontSize(23).fillColor(C.navy).text('From report to refinanced, in three steps', M, y, { width: CW, characterSpacing: -0.5 });
  y += 40;

  const steps = [
    { n: '01', badge: 1, title: 'We confirm your rate', body: 'Your adviser locks in the numbers in this report with the lender and confirms eligibility.', grad: [C.green, C.teal] },
    { n: '02', badge: 2, title: 'We handle the paperwork', body: 'We manage the application, valuation and lender negotiation from start to finish.', grad: [C.teal, C.navy] },
    { n: '03', badge: 3, title: 'You start saving', body: `Your new rate takes effect at settlement — ${moneyNZ(calc.monthly_saving)}/mo back in your pocket.`, grad: [C.navy, C.navy] },
  ];
  const gap = 14;
  const sw = (CW - gap * 2) / 3;
  const sh = 132;
  steps.forEach((s, i) => {
    const sx = M + i * (sw + gap);
    doc.roundedRect(sx, y, sw, sh, 14).lineWidth(1).stroke(C.border);
    // giant faded numeral
    doc.save().fillOpacity(0.05).font(F.black).fontSize(52).fillColor(C.navy).text(s.n, sx + sw - 76, y + 10, { width: 66, align: 'right', lineBreak: false, characterSpacing: -3 });
    doc.fillOpacity(1).restore();
    // gradient number badge
    const bg = doc.linearGradient(sx + 20, y + 20, sx + 46, y + 46).stop(0, s.grad[0]).stop(1, s.grad[1]);
    doc.circle(sx + 33, y + 33, 13).fill(bg);
    doc.font(F.black).fontSize(11).fillColor(C.white).text(String(s.badge), sx + 20, y + 27, { width: 26, align: 'center' });
    // text
    const titleW = sw - 40;
    doc.font(F.bold).fontSize(12.5);
    const th = doc.heightOfString(s.title, { width: titleW });
    doc.fillColor(C.navy).text(s.title, sx + 20, y + 58, { width: titleW });
    doc.font(F.med).fontSize(9.5).fillColor(C.body).text(s.body, sx + 20, y + 58 + th + 6, { width: titleW, lineGap: 2 });
  });
  y += sh + 22;

  // adviser card (navy, gradient avatar)
  const adH = 84;
  softShadow(doc, M, y, CW, adH, 16);
  doc.roundedRect(M, y, CW, adH, 16).fill(navyGrad(doc, M, y, M + CW, y + adH));
  const avX = M + 34, avY = y + adH / 2;
  doc.circle(avX + 6, avY, 24).fill(doc.linearGradient(avX - 18, avY + 24, avX + 30, avY - 24).stop(0, C.green).stop(1, C.teal));
  doc.font(F.black).fontSize(15).fillColor(C.white).text(ADVISER.initials, avX - 18, avY - 8, { width: 48, align: 'center' });
  doc.font(F.bold).fontSize(14).fillColor(C.white).text(ADVISER.name, M + 82, y + 24);
  doc.font(F.med).fontSize(9.5).fillColor('#8895A7').text(`Your licensed mortgage adviser · ${ADVISER.fsp}`, M + 82, y + 44);
  doc.font(F.bold).fontSize(10.5).fillColor(C.white).text(ADVISER.email, M, y + 26, { width: CW - 28, align: 'right' });
  doc.font(F.med).fontSize(10.5).fillColor('#8895A7').text(ADVISER.phone, M, y + 44, { width: CW - 28, align: 'right' });
  y += adH + 16;

  // CTA
  const ctaH = 52;
  doc.roundedRect(M, y, CW, ctaH, 12).fill(brandGrad(doc, M, y, M + CW, y));
  doc.font(F.bold).fontSize(13).fillColor(C.white).text('Book your free call  →', M, y + 18, { width: CW, align: 'center' });
  y += ctaH + 16;

  // disclaimer — box sized to content
  const discBody =
    'This report is an estimate only and does not constitute financial advice. Figures are based on standard New Zealand amortisation methodology and indicative market rates as at the date this report was prepared, and may change based on lender assessment, your individual circumstances, and final valuation. Cashback contributions are subject to lender terms and may be subject to pro-rata clawback if you repay or switch lenders within the offer’s minimum term. Wealthify Limited is a licensed Financial Advice Provider (FAP) under the Financial Markets Conduct Act 2013. Your personalised numbers will be confirmed in writing by a licensed adviser before you make any decision to refinance.';
  doc.font(F.med).fontSize(8.5);
  const discBodyH = doc.heightOfString(discBody, { width: CW - 40, lineGap: 3 });
  const dH = 16 + 12 + discBodyH + 18;
  doc.roundedRect(M, y, CW, dH, 12).fillAndStroke(C.surface, C.border);
  doc.font(F.bold).fontSize(8.5).fillColor(C.body).text('IMPORTANT INFORMATION', M + 20, y + 16, { characterSpacing: 0.5 });
  doc.font(F.med).fontSize(8.5).fillColor(C.muted).text(discBody, M + 20, y + 32, { width: CW - 40, lineGap: 3 });
}

// ─────────────────────────────────────────────────────────────
function generateReportPdf(lead) {
  const calc = computeRefinance({
    loan_balance: lead.loan_balance,
    current_rate: lead.current_rate,
    years_remaining: lead.years_remaining,
    target_new_rate: lead.target_new_rate,
    cashback_pct: lead.cashback_pct,
    break_fee: lead.break_fee,
    legal_costs: lead.legal_costs,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    registerFonts(doc);

    coverPage(doc, lead, calc);
    doc.addPage();
    summaryPage(doc, lead, calc);
    doc.addPage();
    breakdownPage(doc, lead, calc);
    doc.addPage();
    whyPage(doc, lead, calc);
    doc.addPage();
    nextStepsPage(doc, lead, calc);

    doc.end();
  });
}

module.exports = { generateReportPdf };
