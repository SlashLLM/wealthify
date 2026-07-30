const { sendEmail } = require('./email');

const BRAND = {
  navy: '#0B1F3A',
  ink: '#1A2433',
  body: '#5B6B82',
  green: '#16C172',
  greenDark: '#0E9E5C',
  teal: '#0FB5BA',
  surface: '#F6F8FB',
  border: '#E4E9F0',
  white: '#FFFFFF',
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

function emailLayout({ title, bodyHtml }) {
  const gradId = 'wgContact';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.white};border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
          <tr>
            <td style="background:${BRAND.navy};padding:28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;vertical-align:middle;">${logoSvg(gradId)}</td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:20px;font-weight:800;color:${BRAND.white};letter-spacing:-0.5px;line-height:1;">Wealthify</div>
                    <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px;">Licensed NZ Financial Advice Provider</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};">
              <p style="margin:0;font-size:12px;color:${BRAND.body};line-height:1.6;text-align:center;">
                &copy; ${new Date().getFullYear()} Wealthify. All rights reserved.<br>
                This email is not financial advice. A licensed adviser will confirm anything specific to your situation.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:13px;color:${BRAND.body};width:140px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font-size:14px;color:${BRAND.ink};font-weight:600;vertical-align:top;">${esc(value)}</td>
  </tr>`;
}

function messageBlock(message) {
  const paragraphs = String(message)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 10px;font-size:14px;color:${BRAND.ink};line-height:1.65;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="background:${BRAND.surface};border-radius:8px;padding:16px 20px;margin-top:20px;">
    <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${BRAND.body};">Message</p>
    ${paragraphs}
  </div>`;
}

function renderAdminContactEmail(enquiry) {
  const title = 'New website enquiry';
  const bodyHtml = `
    <div style="display:inline-block;background:rgba(22,193,114,0.12);color:${BRAND.greenDark};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:6px 12px;border-radius:6px;margin-bottom:16px;">
      Contact form
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.5px;line-height:1.2;">
      ${esc(enquiry.full_name)} wants to talk about ${esc(enquiry.enquiry_type.toLowerCase())}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.body};line-height:1.6;">
      Submitted through the Wealthify contact form. Reply directly to this email to reach them.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border-radius:8px;padding:4px 16px;">
      ${detailRow('Full name', enquiry.full_name)}
      ${detailRow('Email', enquiry.email)}
      ${detailRow('Phone', enquiry.phone)}
      ${detailRow('Enquiry about', enquiry.enquiry_type)}
      ${enquiry.adviser_name ? detailRow('Adviser requested', enquiry.adviser_name) : ''}
      ${detailRow('Submitted', fmtDateNZ())}
    </table>
    ${messageBlock(enquiry.message)}`;

  return {
    subject: `Contact form — ${enquiry.full_name} (${enquiry.enquiry_type})`,
    html: emailLayout({ title, bodyHtml }),
  };
}

function renderContactAcknowledgementEmail(enquiry) {
  const first = String(enquiry.full_name).trim().split(/\s+/)[0];
  const who = enquiry.adviser_name || 'one of our licensed advisers';
  const title = 'We have got your message — Wealthify';
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.5px;line-height:1.2;">
      Thanks, ${esc(first)} — we have got your message
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.body};line-height:1.65;">
      We have received your enquiry about ${esc(enquiry.enquiry_type.toLowerCase())} and ${esc(who)} will be in touch within one business day.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.ink};">What happens next?</p>
          <p style="margin:0;font-size:13.5px;color:${BRAND.body};line-height:1.6;">
            We will call or email to understand what you are trying to achieve, then lay out your options in plain English. Our advice is free, with no obligation to go ahead.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:${BRAND.body};">For your records</p>
    <p style="margin:0;font-size:13.5px;color:${BRAND.ink};line-height:1.65;">${esc(enquiry.message).replace(/\n/g, '<br>')}</p>`;

  return {
    subject: 'Thanks for getting in touch — Wealthify',
    html: emailLayout({ title, bodyHtml }),
  };
}

async function sendAdminContactNotification(enquiry) {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  if (!adminEmail) {
    console.warn('[email] ADMIN_EMAIL not configured — skipping contact notification');
    return;
  }

  const { subject, html } = renderAdminContactEmail(enquiry);
  await sendEmail({ to: adminEmail, subject, html, replyTo: enquiry.email });
}

async function sendContactAcknowledgement(enquiry) {
  try {
    const { subject, html } = renderContactAcknowledgementEmail(enquiry);
    await sendEmail({ to: enquiry.email, subject, html });
  } catch (err) {
    console.error('[email] Failed to send contact acknowledgement:', err.message);
  }
}

module.exports = {
  renderAdminContactEmail,
  renderContactAcknowledgementEmail,
  sendAdminContactNotification,
  sendContactAcknowledgement,
};
