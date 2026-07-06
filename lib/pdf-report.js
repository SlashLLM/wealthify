const PDFDocument = require('pdfkit');
const { computeRefinance } = require('./refinance-calc');

const NAVY = '#0B1F3A';
const GREEN = '#16C172';
const MUTED = '#8B9AAD';
const BORDER = '#E4E9F0';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMoney(n) {
  return '$' + Math.abs(Math.round(n)).toLocaleString('en-NZ');
}

function drawOptionBox(doc, x, y, w, h, label, value, unit, hint) {
  doc
    .roundedRect(x, y, w, h, 6)
    .lineWidth(1)
    .strokeColor(BORDER)
    .stroke();

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(NAVY)
    .text(label, x + 10, y + 10, { width: w - 20 });

  doc
    .roundedRect(x + 10, y + 26, w - 20, 28, 4)
    .fillColor('#F6F8FB')
    .fill();

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(NAVY)
    .text(value, x + 16, y + 33, { width: w - 50, continued: false });

  if (unit) {
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(MUTED)
      .text(unit, x + w - 28, y + 35);
  }

  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(MUTED)
    .text(hint, x + 10, y + h - 18, { width: w - 20 });
}

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
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor(NAVY)
      .text('Wealthify', { continued: false });

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(MUTED)
      .text('Refinance Savings Report', { continued: false });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(MUTED)
      .text(`Prepared ${formatDate(lead.created_at)}`, { continued: false });

    doc.moveDown(1.2);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(NAVY)
      .text('Client details', { continued: false });

    doc.moveDown(0.4);
    const details = [
      ['Email', lead.email || '—'],
      ['Phone', lead.phone || '—'],
      ['Property address', lead.property_address || '—'],
      ['Loan balance', formatMoney(lead.loan_balance || 0)],
      ['Current rate', `${lead.current_rate ?? '—'}%`],
      ['Years remaining', String(lead.years_remaining ?? '—')],
    ];
    details.forEach(([label, value]) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(MUTED)
        .text(label + ': ', { continued: true })
        .font('Helvetica')
        .fillColor(NAVY)
        .text(value, { continued: false });
    });

    doc.moveDown(1);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(NAVY)
      .text('Your refinance savings', { continued: false });

    doc.moveDown(0.5);
    const results = [
      ['Monthly saving', formatMoney(calc.monthly_saving) + '/mo', GREEN],
      ['Total interest saved', formatMoney(calc.interest_saved), GREEN],
      ['Cashback offered', formatMoney(calc.cashback), '#C9A227'],
      ['Switch costs (break fee + legals)', formatMoney(calc.switch_cost), NAVY],
      ['Net benefit (year 1)', formatMoney(calc.net_year1), calc.net_year1 >= 0 ? GREEN : '#D64545'],
    ];

    const boxW = (doc.page.width - 96 - 12) / 2;
    let rx = 48;
    let ry = doc.y;
    results.forEach((item, i) => {
      if (i === 4) {
        rx = 48;
        ry += 72;
      }
      doc
        .roundedRect(rx, ry, boxW, 60, 6)
        .fillColor('#F6F8FB')
        .fill();
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(MUTED)
        .text(item[0], rx + 12, ry + 10, { width: boxW - 24 });
      doc
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(item[2])
        .text(item[1], rx + 12, ry + 28, { width: boxW - 24 });
      rx += boxW + 12;
      if (i % 2 === 1 && i < 4) {
        rx = 48;
        ry += 72;
      }
    });

    doc.y = ry + 80;

    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(NAVY)
      .text('Refinance options', { continued: false });

    doc.moveDown(0.5);
    const optY = doc.y;
    const optW = (doc.page.width - 96 - 12) / 2;
    const optH = 78;

    drawOptionBox(
      doc,
      48,
      optY,
      optW,
      optH,
      'Target new rate',
      String(lead.target_new_rate ?? '4.79'),
      '%',
      'NZ fixed rates Jun 2026: 4.49–4.79%'
    );
    drawOptionBox(
      doc,
      48 + optW + 12,
      optY,
      optW,
      optH,
      'Cashback',
      String(lead.cashback_pct ?? '0.90'),
      '%',
      'Typically 0.85–1.25%, capped ~$20k'
    );
    drawOptionBox(
      doc,
      48,
      optY + optH + 12,
      optW,
      optH,
      'Break fee',
      formatMoney(lead.break_fee ?? 0).replace('$', ''),
      '$',
      'Near $0 at rollover date'
    );
    drawOptionBox(
      doc,
      48 + optW + 12,
      optY + optH + 12,
      optW,
      optH,
      'Legal costs',
      formatMoney(lead.legal_costs ?? 1200).replace('$', ''),
      '$',
      'Typical NZ legals: $800–$1,500'
    );

    doc.y = optY + optH * 2 + 36;

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        'Estimate only — not financial advice. Based on standard NZ amortisation and Jun 2026 market rates. Cashback is subject to lender terms and pro-rata clawback if you repay early. Wealthify is a licensed NZ Financial Advice Provider (FAP); your personalised numbers are confirmed by an adviser before you act.',
        48,
        doc.y,
        { width: doc.page.width - 96, align: 'left' }
      );

    doc.end();
  });
}

module.exports = { generateReportPdf };
