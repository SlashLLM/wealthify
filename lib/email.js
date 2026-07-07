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

async function sendEmail({ to, subject, html }) {
  const resend = getResend();
  const from = getFromAddress();

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send email');
  }

  return data;
}

module.exports = {
  sendEmail,
};
