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
      .select('tier, stripe_customer_id, stripe_subscription_id').eq('id', user.id).single();

    let tier = profile?.tier || 'free';
    let portalUrl = null;

    if (process.env.STRIPE_SECRET_KEY && profile?.stripe_customer_id) {
      try {
        // Verify tier against Stripe — try direct sub retrieval first, then list
        let priceId = null;
        if (profile.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, process.env.STRIPE_SECRET_KEY);
            if (sub.status === 'active' || sub.status === 'trialing') {
              priceId = sub.items?.data?.[0]?.price?.id;
            }
          } catch(e) { console.warn('Sub retrieve:', e.message); }
        }
        if (!priceId) {
          const subs = await stripe.subscriptions.list({
            customer: profile.stripe_customer_id, status: 'active', limit: 1
          }, process.env.STRIPE_SECRET_KEY);
          if (subs.data && subs.data.length > 0) {
            priceId = subs.data[0].items?.data?.[0]?.price?.id;
          }
        }
        if (priceId) {
          const plus = [process.env.STRIPE_PRICE_PLUS_MONTHLY, process.env.STRIPE_PRICE_PLUS_YEARLY];
          const pro  = [process.env.STRIPE_PRICE_PRO_MONTHLY,  process.env.STRIPE_PRICE_PRO_YEARLY];
          const stripeTier = pro.includes(priceId) ? 'pro' : plus.includes(priceId) ? 'plus' : 'free';
          if (stripeTier !== tier) {
            console.log(`Tier mismatch: db=${tier} stripe=${stripeTier} for ${profile.stripe_customer_id} — correcting`);
            await supabase.from('profiles').update({ tier: stripeTier }).eq('id', user.id);
            tier = stripeTier;
          }
        }
      } catch(e) { console.warn('Stripe tier verify:', e.message); }

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
