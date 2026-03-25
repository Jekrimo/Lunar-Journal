const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Tell Vercel NOT to parse the body — Stripe needs the raw bytes to verify signature
module.exports.config = { api: { bodyParser: false } };

// Map Stripe price IDs to tier names
function tierFromPriceId(priceId) {
  const plus = [process.env.STRIPE_PRICE_PLUS_MONTHLY, process.env.STRIPE_PRICE_PLUS_YEARLY];
  const pro  = [process.env.STRIPE_PRICE_PRO_MONTHLY,  process.env.STRIPE_PRICE_PRO_YEARLY];
  if (plus.includes(priceId)) return 'plus';
  if (pro.includes(priceId))  return 'pro';
  return 'free';
}

async function updateUserTier(customerId, tier, subscriptionId = null) {
  const update = { tier };
  if (subscriptionId) update.stripe_subscription_id = subscriptionId;

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('stripe_customer_id', customerId);

  if (error) console.error('updateUserTier error:', error.message);
  else console.log('Updated tier to', tier, 'for customer', customerId);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  // Read raw body as buffer for Stripe signature verification
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature failed:', e.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const data = event.data.object;

  switch (event.type) {

    // Subscription created or updated — set tier
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const priceId = data.items?.data?.[0]?.price?.id;
      const tier = data.status === 'active' || data.status === 'trialing'
        ? tierFromPriceId(priceId)
        : 'free';
      await updateUserTier(data.customer, tier, data.id);
      break;
    }

    // Subscription cancelled or payment failed — downgrade to free
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const customerId = data.customer || data.subscription;
      await updateUserTier(customerId, 'free');
      break;
    }

    // Checkout completed — also update tier as belt-and-suspenders
    case 'checkout.session.completed': {
      if (data.mode === 'subscription' && data.subscription) {
        const sub = await stripe.subscriptions.retrieve(data.subscription);
        const priceId = sub.items?.data?.[0]?.price?.id;
        const tier = tierFromPriceId(priceId);
        await updateUserTier(data.customer, tier, data.subscription);
      }
      break;
    }

    default:
      // Ignore unhandled events
      break;
  }

  res.json({ received: true });
};
