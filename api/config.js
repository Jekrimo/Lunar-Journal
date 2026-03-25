module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store');

  res.send(`
window.SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || '')};
window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};
window.STRIPE_PRICE_PLUS_MONTHLY = ${JSON.stringify(process.env.STRIPE_PRICE_PLUS_MONTHLY || '')};
window.STRIPE_PRICE_PLUS_YEARLY  = ${JSON.stringify(process.env.STRIPE_PRICE_PLUS_YEARLY  || '')};
window.STRIPE_PRICE_PRO_MONTHLY  = ${JSON.stringify(process.env.STRIPE_PRICE_PRO_MONTHLY  || '')};
window.STRIPE_PRICE_PRO_YEARLY   = ${JSON.stringify(process.env.STRIPE_PRICE_PRO_YEARLY   || '')};
  `.trim());
};
