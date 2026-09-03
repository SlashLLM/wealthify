const { sendEmail } = require('./email');

const BRAND = {
  navy: '#0B1F3A',
  navyDeep: '#071929',
  ink: '#1A2433',
  body: '#5B6B82',
  muted: '#8B9AAD',
  green: '#16C172',
  greenDark: '#0E9E5C',
  teal: '#0FB5BA',
  gold: '#E8B04B',
  goldDark: '#8A6520',
  red: '#C84040',
  surface: '#F6F8FB',
  border: '#E4E9F0',
  white: '#FFFFFF',
};

const PROGRAMS = {
  'partner-circle': 'Wealthify Partner Circle',
  'wealthify-score': 'Wealthify Score',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDateNZ(d) {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function logoSvg(id) {
  return `<svg width="34" height="26" viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="${id}" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="${BRAND.green}"/><stop offset="100%" stop-color="${BRAND.teal}"/></linearGradient></defs>
    <rect x="0" y="13" width="5" height="13" rx="1.5" fill="url(#${id})"/>
    <rect x="7" y="6" width="5" height="20" rx="1.5" fill="url(#${id})"/>
    <rect x="14.5" y="9" width="5" height="17" rx="1.5" fill="url(#${id})"/>
    <rect x="22" y="2" width="5" height="24" rx="1.5" fill="url(#${id})"/>
    <rect x="29" y="0" width="5" height="26" rx="1.5" fill="url(#${id})"/>
  </svg>`;
}

function logoSvgMono(color) {
  return `<svg width="34" height="26" viewBox="0 0 34 26" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="13" width="5" height="13" rx="1.5" fill="${color}"/>
    <rect x="7" y="6" width="5" height="20" rx="1.5" fill="${color}"/>
    <rect x="14.5" y="9" width="5" height="17" rx="1.5" fill="${color}"/>
    <rect x="22" y="2" width="5" height="24" rx="1.5" fill="${color}"/>
    <rect x="29" y="0" width="5" height="26" rx="1.5" fill="${color}"/>
  </svg>`;
}

const FONT_STACK = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function shell({ title, headerHtml, bodyHtml, footerHtml, pageBg, cardBorder }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${pageBg};font-family:${FONT_STACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${pageBg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border-radius:14px;overflow:hidden;border:1px solid ${cardBorder};">
          <tr><td style="padding:0;">${headerHtml}</td></tr>
          <tr><td style="padding:32px;">${bodyHtml}</td></tr>
          <tr><td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};">${footerHtml}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* ── Partner Circle: green→teal gradient header, ringed monogram, detail table ── */

function circleHeader() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.green};background-image:linear-gradient(120deg,${BRAND.green} 0%,${BRAND.teal} 100%);">
    <tr>
      <td style="padding:26px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:12px;vertical-align:middle;">${logoSvgMono(BRAND.white)}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:19px;font-weight:800;color:${BRAND.white};letter-spacing:-0.4px;line-height:1;">Partner Circle</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:3px;">Wealthify homeowner benefits network</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function monogramBlock(name) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px;">
    <tr>
      <td align="center" style="padding:22px 0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
          <tr>
            <td align="center" valign="middle" width="84" height="84" style="width:84px;height:84px;border-radius:50%;background:rgba(22,193,114,0.10);border:2px solid rgba(22,193,114,0.30);font-size:28px;font-weight:800;color:${BRAND.greenDark};letter-spacing:0.5px;text-align:center;">${esc(initials(name))}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:11px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.body};width:130px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.ink};font-weight:600;vertical-align:top;">${esc(value)}</td>
  </tr>`;
}

function renderAdminPartnerCircleEmail(lead) {
  const bodyHtml = `
    ${monogramBlock(lead.full_name)}
    <div style="text-align:center;">
      <div style="display:inline-block;background:rgba(22,193,114,0.12);color:${BRAND.greenDark};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;padding:6px 12px;border-radius:100px;margin-bottom:14px;">
        New Circle member
      </div>
      <h1 style="margin:0 0 8px;font-size:23px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.5px;line-height:1.2;">
        ${esc(lead.full_name)} joined the Partner Circle
      </h1>
      <p style="margin:0 0 26px;font-size:14px;color:${BRAND.body};line-height:1.6;">
        Signed up from the Partner Circle page. Reply to this email to reach them directly.
      </p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border-radius:10px;padding:4px 18px;">
      ${detailRow('Full name', lead.full_name)}
      ${detailRow('Email', lead.email)}
      ${detailRow('Mobile', lead.phone)}
      ${detailRow('Submitted', fmtDateNZ(lead.created_at))}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-left:3px solid ${BRAND.green};background:rgba(22,193,114,0.06);border-radius:0 10px 10px 0;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${BRAND.greenDark};">Next step</p>
          <p style="margin:0;font-size:13.5px;color:${BRAND.ink};line-height:1.6;">
            Confirm their details, then send their Circle member access and the partner categories live in their area.
          </p>
        </td>
      </tr>
    </table>`;

  const footerHtml = `<p style="margin:0;font-size:12px;color:${BRAND.body};line-height:1.6;text-align:center;">
      &copy; ${new Date().getFullYear()} Wealthify. All rights reserved.<br>
      Partner Circle providers are verified before joining. Wealthify does not carry out or warrant their work.
    </p>`;

  return {
    subject: `Partner Circle — ${lead.full_name} joined`,
    html: shell({
      title: 'New Partner Circle member',
      headerHtml: circleHeader(),
      bodyHtml,
      footerHtml,
      pageBg: '#EEF7F3',
      cardBorder: 'rgba(22,193,114,0.28)',
    }),
  };
}

/* ── Wealthify Score: navy header + gold rule, empty dial, stacked cards, band strip ── */

function scoreHeader() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="height:5px;background:${BRAND.gold};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr>
      <td style="background:${BRAND.navyDeep};padding:26px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:12px;vertical-align:middle;">${logoSvg('wgScore')}</td>
            <td style="vertical-align:middle;">
              <div style="font-size:19px;font-weight:800;color:${BRAND.white};letter-spacing:-0.4px;line-height:1;">Wealthify Score</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:3px;letter-spacing:0.3px;">Financial health check request</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function emptyDial() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
    <tr>
      <td align="center" style="padding:20px 0 6px;">
        <svg width="118" height="118" viewBox="0 0 118 118" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="59" cy="59" r="50" stroke="${BRAND.border}" stroke-width="10" fill="none"/>
          <circle cx="59" cy="59" r="50" stroke="${BRAND.gold}" stroke-width="10" fill="none"
                  stroke-linecap="round" stroke-dasharray="6 16" transform="rotate(-90 59 59)" opacity="0.55"/>
          <text x="59" y="66" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="bold" fill="${BRAND.muted}">&#8212;</text>
        </svg>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${BRAND.muted};margin-top:8px;">Not yet assessed</div>
      </td>
    </tr>
  </table>`;
}

function contactCard(label, value, href) {
  const inner = href
    ? `<a href="${esc(href)}" style="color:${BRAND.navy};font-weight:700;text-decoration:none;">${esc(value)}</a>`
    : `<span style="color:${BRAND.navy};font-weight:700;">${esc(value)}</span>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;background:${BRAND.white};border:1px solid ${BRAND.border};border-radius:10px;">
    <tr>
      <td style="padding:13px 16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${BRAND.muted};margin-bottom:4px;">${esc(label)}</div>
        <div style="font-size:15px;line-height:1.4;">${inner}</div>
      </td>
    </tr>
  </table>`;
}

function bandStrip() {
  const bands = [
    ['80-100', 'Strong', BRAND.green],
    ['60-79', 'Healthy', BRAND.teal],
    ['40-59', 'Needs attention', BRAND.gold],
    ['0-39', 'Priority support', BRAND.red],
  ];
  const cells = bands.map(([range, label, color], i) => {
    const radius = i === 0 ? 'border-radius:8px 0 0 8px;' : i === bands.length - 1 ? 'border-radius:0 8px 8px 0;' : '';
    return `<td width="25%" align="center" style="background:${color};padding:10px 4px;${radius}">
      <div style="font-size:13px;font-weight:800;color:${BRAND.white};line-height:1;">${range}</div>
      <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.88);margin-top:3px;line-height:1.2;">${label}</div>
    </td>`;
  }).join('');

  return `<div style="margin-top:24px;">
    <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${BRAND.muted};">Score bands</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
      <tr>${cells}</tr>
    </table>
  </div>`;
}

function renderAdminScoreEmail(lead) {
  const bodyHtml = `
    ${emptyDial()}
    <div style="text-align:center;">
      <div style="display:inline-block;background:rgba(232,176,75,0.14);color:${BRAND.goldDark};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;padding:6px 12px;border-radius:6px;margin-bottom:14px;">
        Score check requested
      </div>
      <h1 style="margin:0 0 8px;font-size:23px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.5px;line-height:1.2;">
        ${esc(lead.full_name)} wants a Wealthify Score
      </h1>
      <p style="margin:0 0 26px;font-size:14px;color:${BRAND.body};line-height:1.6;">
        Requested from the Wealthify Score page on ${esc(fmtDateNZ(lead.created_at))}.
      </p>
    </div>
    ${contactCard('Full name', lead.full_name)}
    ${contactCard('Email', lead.email, `mailto:${lead.email}`)}
    ${contactCard('Mobile', lead.phone, `tel:${String(lead.phone).replace(/[^\d+]/g, '')}`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:${BRAND.navyDeep};border-radius:10px;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${BRAND.gold};">Next step</p>
          <p style="margin:0;font-size:13.5px;color:rgba(255,255,255,0.82);line-height:1.65;">
            Book the 30-minute check, collect the figures you need, then record the score inputs, assumptions and agreed actions before the next review date.
          </p>
        </td>
      </tr>
    </table>
    ${bandStrip()}`;

  const footerHtml = `<p style="margin:0;font-size:12px;color:${BRAND.body};line-height:1.6;text-align:center;">
      &copy; ${new Date().getFullYear()} Wealthify. All rights reserved.<br>
      The Wealthify Score is Wealthify's own financial wellness indicator — not a bank credit score,
      a lending approval, or a guarantee of any financial outcome.
    </p>`;

  return {
    subject: `Wealthify Score — ${lead.full_name} requested a check`,
    html: shell({
      title: 'New Wealthify Score request',
      headerHtml: scoreHeader(),
      bodyHtml,
      footerHtml,
      pageBg: '#F1F3F7',
      cardBorder: BRAND.border,
    }),
  };
}

function renderAdminProgramEmail(lead) {
  return lead.program === 'partner-circle'
    ? renderAdminPartnerCircleEmail(lead)
    : renderAdminScoreEmail(lead);
}

async function sendAdminProgramNotification(lead) {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  if (!adminEmail) {
    console.warn('[email] ADMIN_EMAIL not configured — skipping program notification');
    return;
  }

  const { subject, html } = renderAdminProgramEmail(lead);
  await sendEmail({ to: adminEmail, subject, html, replyTo: lead.email });
}

module.exports = {
  PROGRAMS,
  renderAdminPartnerCircleEmail,
  renderAdminScoreEmail,
  renderAdminProgramEmail,
  sendAdminProgramNotification,
};
