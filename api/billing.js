const { createClient } = require('@supabase/supabase-js');
const stripe = require('../lib/stripe-client');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Database not configured' });

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No auth token' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  try {
    const { data: profile } = await supabase.from('profiles')
      .select('tier, stripe_customer_id').eq('id', user.id).single();

    const tier = profile?.tier || 'free';
    let portalUrl = null;

    if (process.env.STRIPE_SECRET_KEY && profile?.stripe_customer_id) {
      try {
        const baseUrl = req.headers.origin || 'https://lunations.app';
        const session = await stripe.billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: baseUrl + '/app',
        }, process.env.STRIPE_SECRET_KEY);
        portalUrl = session.url;
      } catch(e) {
        console.warn('Billing portal error:', e.message);
      }
    }

    return res.json({ tier, portalUrl });
  } catch(e) {
    console.error('billing error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
