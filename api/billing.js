const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier, stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    const result = {
      tier: profile?.tier || 'free',
      portalUrl: null
    };

    // If they have a Stripe customer, create a billing portal session
    if (profile?.stripe_customer_id) {
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: 'https://lunations.app/app',
      });
      result.portalUrl = session.url;
    }

    res.json(result);
  } catch (e) {
    console.error('billing error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
