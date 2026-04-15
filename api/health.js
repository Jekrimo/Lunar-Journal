// Health check (GET) + Feedback submission (POST)
const { Resend } = require('resend');

const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + 3600000 };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + 3600000; }
  record.count++;
  rateLimitMap.set(ip, record);
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) { if (now > v.resetAt) rateLimitMap.delete(k); }
  }
  return record.count > 10;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET = health check
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    const checks = {
      api: 'ok',
      supabase_url: !!process.env.SUPABASE_URL ? 'set' : 'MISSING',
      supabase_anon_key: !!process.env.SUPABASE_ANON_KEY ? 'set' : 'MISSING',
      anthropic_key: !!process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING',
    };
    const allOk = Object.values(checks).every(v => v === 'ok' || v === 'set');
    return res.status(allOk ? 200 : 500).json({
      status: allOk ? 'healthy' : 'degraded',
      checks,
      ts: new Date().toISOString(),
    });
  }

  // POST = feedback submission
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Rate limit reached — try again shortly' });

  const { type, message, accountId, context } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
  }

  const feedbackType = type === 'bug' ? 'Bug Report' : 'Feedback';
  const subject = `[Lunations Feedback] ${feedbackType}`;

  let body = `<h2>${feedbackType}</h2>`;
  body += `<p><strong>Message:</strong></p><p>${escapeHtml(message)}</p>`;
  if (accountId) body += `<p><strong>Account ID:</strong> ${escapeHtml(accountId)}</p>`;
  if (context) {
    body += `<hr><h3>Context</h3>`;
    if (context.view) body += `<p><strong>Active View:</strong> ${escapeHtml(context.view)}</p>`;
    if (context.moonPhase) body += `<p><strong>Moon Phase:</strong> ${escapeHtml(context.moonPhase)}</p>`;
    if (context.userAgent) body += `<p><strong>Browser/OS:</strong> ${escapeHtml(context.userAgent)}</p>`;
  }
  body += `<hr><p style="color:#999;font-size:12px;">Sent from Lunations app at ${new Date().toISOString()}</p>`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Lunations Feedback <onboarding@resend.dev>',
      to: 'hello@lunations.app',
      subject,
      html: body,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[feedback] send error:', err);
    return res.status(500).json({ error: 'Failed to send feedback' });
  }
};
