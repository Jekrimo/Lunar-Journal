const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Map price IDs to tier names for display
const PRICE_TIERS = {
  [process.env.STRIPE_PRICE_PLUS_MONTHLY]:  'plus',
  [process.env.STRIPE_PRICE_PLUS_YEARLY]:   'plus',
  [process.env.STRIPE_PRICE_PRO_MONTHLY]:   'pro',
  [process.env.STRIPE_PRICE_PRO_YEARLY]:    'pro',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify auth
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  const { priceId, billingInterval } = req.body;
  if (!priceId) return res.status(400).json({ error: 'priceId required' });
  if (!PRICE_TIERS[priceId]) return res.status(400).json({ error: 'Invalid price ID' });

  try {
    // Check if user already has a Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    // Create Stripe customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.name || '',
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { supabase_user_id: user.id }
      },
      success_url: 'https://lunations.app/app?upgraded=1',
      cancel_url: 'https://lunations.app/app?upgrade=cancelled',
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error('create-checkout error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
