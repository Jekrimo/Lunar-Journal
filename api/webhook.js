// Tell Vercel NOT to parse body - Stripe needs raw bytes for signature verification
module.exports.config = { api: { bodyParser: false } };

const { createClient } = require('@supabase/supabase-js');

function tierFromPriceId(priceId) {
  const plus = [process.env.STRIPE_PRICE_PLUS_MONTHLY, process.env.STRIPE_PRICE_PLUS_YEARLY];
  const pro  = [process.env.STRIPE_PRICE_PRO_MONTHLY,  process.env.STRIPE_PRICE_PRO_YEARLY];
  if (plus.includes(priceId)) return 'plus';
  if (pro.includes(priceId))  return 'pro';
  return 'free';
}

async function updateUserTier(supabase, customerId, tier, subscriptionId) {
  const update = { tier };
  if (subscriptionId) update.stripe_subscription_id = subscriptionId;
  const { error } = await supabase.from('profiles')
    .update(update).eq('stripe_customer_id', customerId);
  if (error) console.error('updateUserTier error:', error.message);
  else console.log('Tier updated to', tier, 'for', customerId);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  let stripe;
  try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); }
  catch(e) { return res.status(500).json({ error: 'stripe package missing: ' + e.message }); }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Read raw body
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch(e) {
    console.error('Webhook signature failed:', e.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const obj = event.data.object;

  try {
    switch(event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const priceId = obj.items?.data?.[0]?.price?.id;
        const tier = (obj.status === 'active' || obj.status === 'trialing')
          ? tierFromPriceId(priceId) : 'free';
        await updateUserTier(supabase, obj.customer, tier, obj.id);
        break;
      }
      case 'customer.subscription.deleted':
        await updateUserTier(supabase, obj.customer, 'free', null);
        break;
      case 'invoice.payment_failed':
        await updateUserTier(supabase, obj.customer, 'free', null);
        break;
      case 'checkout.session.completed':
        if (obj.mode === 'subscription' && obj.subscription) {
          const sub = await stripe.subscriptions.retrieve(obj.subscription);
          const priceId = sub.items?.data?.[0]?.price?.id;
          await updateUserTier(supabase, obj.customer, tierFromPriceId(priceId), obj.subscription);
        }
        break;
    }
  } catch(e) {
    console.error('Webhook handler error:', e.message);
  }

  res.json({ received: true });
};
