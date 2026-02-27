import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const mailgun = new Mailgun(FormData);
const client = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY || 'key-placeholder' });
const domain = process.env.MAILGUN_DOMAIN || 'mg.sentinel-ai.com';

export const sendEmail = async (to, subject, html) => {
  try {
    if (!process.env.MAILGUN_API_KEY) {
      console.warn('⚠️  Mailgun API key not configured. Email simulation only.');
      return { success: false, reason: 'no-api-key', message: `[SIMULATED] Email to ${to}` };
    }
    
    const msg = {
      from: `SentinelAI <noreply@${domain}>`,
      to,
      subject,
      html
    };

    const result = await client.messages.create(domain, msg);
    console.log('✓ Email sent:', result.id);
    return { success: true, messageId: result.id };
  } catch (err) {
    console.error('✗ Mailgun error:', err.message);
    return { success: false, error: err.message };
  }
};

export const newDeviceLoginEmail = (email, device, ip, location, time) => {
  const html = `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(0,136,255,.3)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold;margin-bottom:4px">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="background:rgba(0,136,255,.08);border:1px solid rgba(0,136,255,.3);border-radius:8px;padding:14px 16px;margin:20px 0">
    <div style="color:#0088ff;font-weight:bold">ℹ NEW DEVICE LOGIN DETECTED</div>
    <div style="color:#88ccff;font-size:.9rem;margin-top:4px">Your account was accessed from an unrecognized device.</div>
  </div>
  <table style="width:100%;font-size:.9rem;margin:20px 0">
    <tr><td style="color:#4a7a6a;padding:6px 0">Device</td><td style="color:#88ccff;text-align:right">${device}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">IP Address</td><td style="color:#88ccff;text-align:right">${ip}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Location</td><td style="color:#88ccff;text-align:right">${location}</td></tr>
    <tr><td style="color:#4a7a6a;padding:6px 0">Time</td><td style="color:#88ccff;text-align:right">${time}</td></tr>
  </table>
  <p style="color:#c8e6de;font-size:.85rem"><strong>Did you just log in?</strong> If not, your account may be compromised. Change your password immediately.</p>
</div>`;
  return sendEmail(email, '🔐 New Device Login to Your Account', html);
};

export const accessKeyUsedEmail = (email, fileName, externalUser, deviceInfo) => {
  const html = `
<div style="font-family:monospace;background:#020b12;color:#c8e6de;padding:32px;border-radius:12px;border:1px solid rgba(255,153,0,.3)">
  <div style="color:#00ffaa;font-size:1.4rem;font-weight:bold">SENTINEL<span style="color:#0088ff">AI</span></div>
  <div style="background:rgba(255,153,0,.08);border:1px solid rgba(255,153,0,.3);border-radius:8px;padding:14px;margin:20px 0">
    <div style="color:#ffaa00;font-weight:bold">⚠ ACCESS KEY USED</div>
    <div style="color:#ffcc77">Someone used an access key to view: <strong>${fileName}</strong></div>
  </div>
  <table style="width:100%;font-size:.9rem;margin:20px 0">
    <tr><td style="color:#4a7a6a">User/Device</td><td style="color:#ffcc77">${externalUser}</td></tr>
    <tr><td style="color:#4a7a6a">Time</td><td style="color:#ffcc77">${new Date().toLocaleString()}</td></tr>
  </table>
  <p style="color:#c8e6de">Review this activity in your dashboard.</p>
</div>`;
  return sendEmail(email, `⚠ Access Key Used on ${fileName}`, html);
};
