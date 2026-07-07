const { sendEmail } = require('./email');

const BRAND = {
  navy: '#0B1F3A',
  ink: '#1A2433',
  body: '#5B6B82',
  green: '#16C172',
  greenDark: '#0E9E5C',
  teal: '#0FB5BA',
  gold: '#E8B04B',
  surface: '#F6F8FB',
  border: '#E4E9F0',
  white: '#FFFFFF',
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
  const gradId = 'wgEmail';
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
                Estimate only — not financial advice. A licensed adviser confirms your numbers before you act.
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

function renderAdminLeadEmail(lead) {
  const title = 'New refinance calculator lead';
  const bodyHtml = `
    <div style="display:inline-block;background:rgba(22,193,114,0.12);color:${BRAND.greenDark};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;padding:6px 12px;border-radius:6px;margin-bottom:16px;">
      New partial lead
    </div>
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.5px;line-height:1.2;">
      Refinance calculator — step 1 completed
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:${BRAND.body};line-height:1.6;">
      Someone started the refinance calculator and submitted their contact details. They have not yet completed step 2 (property address).
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border-radius:8px;padding:4px 16px;">
      ${detailRow('Email', lead.email)}
      ${detailRow('Phone', lead.phone)}
      ${detailRow('Loan balance', fmtMoney(lead.loan_balance))}
      ${detailRow('Current rate', `${lead.current_rate}%`)}
      ${detailRow('Years remaining', String(lead.years_remaining))}
      ${detailRow('Submitted', fmtDateNZ())}
    </table>`;

  return {
    subject: `New refinance calculator lead — ${lead.email}`,
    html: emailLayout({ title, bodyHtml }),
  };
}

function renderClientThankYouEmail(lead) {
  const title = 'Thanks for your interest — Wealthify';
  const bodyHtml = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:800;color:${BRAND.navy};letter-spacing:-0.5px;line-height:1.2;">
      Thank you for your interest
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:${BRAND.body};line-height:1.65;">
      Thanks for using the Wealthify refinance calculator. We have received your details and one of our licensed advisers will reach out to you shortly to walk you through your personalised lender comparison and answer any questions.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};border-radius:8px;padding:16px 20px;margin-bottom:24px;">
      <tr>
        <td>
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.ink};">What happens next?</p>
          <p style="margin:0;font-size:13.5px;color:${BRAND.body};line-height:1.6;">
            An adviser will be in touch within one business day to confirm your numbers, find your best lender, and explain the full switch process — paperwork included. Free, no obligation.
          </p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${BRAND.green};border-radius:8px;padding:12px 24px;">
          <span style="font-size:14px;font-weight:700;color:${BRAND.white};">We will be in touch soon</span>
        </td>
      </tr>
    </table>`;

  return {
    subject: 'Thanks for your interest — Wealthify',
    html: emailLayout({ title, bodyHtml }),
  };
}

async function sendAdminLeadNotification(lead) {
  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  if (!adminEmail) {
    console.warn('[email] ADMIN_EMAIL not configured — skipping admin notification');
    return;
  }

  try {
    const { subject, html } = renderAdminLeadEmail(lead);
    await sendEmail({ to: adminEmail, subject, html });
  } catch (err) {
    console.error('[email] Failed to send admin lead notification:', err.message);
  }
}

async function sendClientThankYou(lead) {
  if (!lead.email) {
    console.warn('[email] No client email — skipping thank-you email');
    return;
  }

  try {
    const { subject, html } = renderClientThankYouEmail(lead);
    await sendEmail({ to: lead.email, subject, html });
  } catch (err) {
    console.error('[email] Failed to send client thank-you email:', err.message);
  }
}

module.exports = {
  renderAdminLeadEmail,
  renderClientThankYouEmail,
  sendAdminLeadNotification,
  sendClientThankYou,
};
