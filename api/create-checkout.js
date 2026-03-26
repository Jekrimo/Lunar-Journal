const { createClient } = require('@supabase/supabase-js');
const stripe = require('../lib/stripe-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const SK = process.env.STRIPE_SECRET_KEY;
  if (!SK) return res.status(500).json({ error: 'Stripe not configured' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Database not configured' });

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No auth token' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { priceId } = req.body || {};
  if (!priceId) return res.status(400).json({ error: 'priceId required' });

  const validPrices = [
    process.env.STRIPE_PRICE_PLUS_MONTHLY, process.env.STRIPE_PRICE_PLUS_YEARLY,
    process.env.STRIPE_PRICE_PRO_MONTHLY,  process.env.STRIPE_PRICE_PRO_YEARLY,
  ].filter(Boolean);
  if (!validPrices.includes(priceId)) return res.status(400).json({ error: 'Invalid price ID' });

  try {
    const { data: profile } = await supabase.from('profiles')
      .select('stripe_customer_id, name').eq('id', user.id).single();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.name || '',
        metadata: { supabase_user_id: user.id }
      }, SK);
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const baseUrl = req.headers.origin || 'https://lunations.app';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: baseUrl + '/app?upgraded=1',
      cancel_url: baseUrl + '/app',
      allow_promotion_codes: 'true',
    }, SK);

    return res.json({ url: session.url });
  } catch(e) {
    console.error('create-checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
