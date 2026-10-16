const { Resend } = require('resend');

let resendClient;

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

function getFromAddress() {
  const from = String(process.env.RESEND_FROM || '').trim();
  if (!from) {
    throw new Error('RESEND_FROM is not configured');
  }
  return from;
}

async function sendEmail({ to, subject, html, replyTo }) {
  // Local testing (.env.local): print instead of sending, so test submissions
  // never email real advisers or whatever address a tester typed in.
  if (process.env.EMAIL_MODE === 'log') {
    console.log(`[email:log] to=${[].concat(to).join(', ')} subject="${subject}" (${html.length} chars, not sent)`);
    return { id: 'logged-not-sent' };
  }

  const resend = getResend();
  const from = getFromAddress();

  const payload = {
    from,
    to,
    subject,
    html,
  };
  if (replyTo) payload.replyTo = replyTo;

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    throw new Error(error.message || 'Failed to send email');
  }

  return data;
}

module.exports = {
  sendEmail,
};
