// Stripe webhook signature verification — no npm needed
const crypto = require('crypto');

module.exports = function constructEvent(rawBody, signature, secret) {
  if (!signature) throw new Error('Missing stripe-signature header');
  
  const parts = signature.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k === 't') acc.timestamp = v;
    if (k === 'v1') acc.signatures.push(v);
    return acc;
  }, { timestamp: null, signatures: [] });

  if (!parts.timestamp) throw new Error('Invalid signature format');

  // Tolerance: 5 minutes
  const tolerance = 300;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(parts.timestamp)) > tolerance) {
    throw new Error('Webhook timestamp too old');
  }

  const payload = parts.timestamp + '.' + rawBody.toString();
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const valid = parts.signatures.some(sig => {
    try { return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex')); }
    catch(e) { return false; }
  });

  if (!valid) throw new Error('Webhook signature verification failed');

  return JSON.parse(rawBody.toString());
};
