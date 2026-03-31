module.exports.config = { api: { bodyParser: false } };

const { createClient } = require('@supabase/supabase-js');
const constructEvent = require('../lib/stripe-webhook');

function tierFromPriceId(priceId) {
  const plus = [process.env.STRIPE_PRICE_PLUS_MONTHLY, process.env.STRIPE_PRICE_PLUS_YEARLY];
  const pro  = [process.env.STRIPE_PRICE_PRO_MONTHLY,  process.env.STRIPE_PRICE_PRO_YEARLY];
  if (plus.includes(priceId)) return 'plus';
  if (pro.includes(priceId))  return 'pro';
  return 'free';
}

async function updateUserTier(supabase, customerId, tier, subscriptionId, subMetadata) {
  const update = { tier };
  if (subscriptionId !== undefined) update.stripe_subscription_id = subscriptionId;
  if (customerId) update.stripe_customer_id = customerId;

  // PATH 1: match by stripe_customer_id
  let { data: rows, error } = await supabase
    .from('profiles').update(update).eq('stripe_customer_id', customerId).select('id');
  if (!error && rows && rows.length > 0) {
    console.log('Tier updated (path1) to', tier, 'for', customerId);
    return rows[0].id;
  }

  // PATH 2: match by supabase_user_id from subscription metadata
  const userId = subMetadata?.supabase_user_id;
  if (userId) {
    ({ error } = await supabase.from('profiles').update(update).eq('id', userId));
    if (!error) { console.log('Tier updated (path2) to', tier, 'for user', userId); return userId; }
    console.error('Path2 error:', error.message);
  }

  // PATH 3: email lookup via Stripe customer
  if (customerId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = require('../lib/stripe-client');
      const customer = await stripe.customers.retrieve(customerId, process.env.STRIPE_SECRET_KEY);
      if (customer?.email) {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const match = (users || []).find(u => u.email === customer.email);
        if (match) {
          ({ error } = await supabase.from('profiles').update(update).eq('id', match.id));
          if (!error) { console.log('Tier updated (path3) to', tier, 'for', customer.email); return match.id; }
        }
      }
    } catch(e) { console.error('Path3 error:', e.message); }
  }

  console.error('updateUserTier: all paths failed for customer', customerId);
  return null;
}

// Cancel all OTHER active subscriptions for this customer to prevent multiples
async function cancelDuplicateSubscriptions(customerId, keepSubId, secretKey) {
  if (!customerId || !keepSubId || !secretKey) return;
  try {
    const stripe = require('../lib/stripe-client');
    const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active' }, secretKey);
    const toCancel = (subs.data || []).filter(s => s.id !== keepSubId);
    for (const sub of toCancel) {
      await stripe.subscriptions.cancel(sub.id, secretKey);
      console.log('Cancelled duplicate subscription', sub.id, 'for customer', customerId);
    }
    if (toCancel.length > 0) {
      console.log(`Cancelled ${toCancel.length} duplicate sub(s) for ${customerId}, keeping ${keepSubId}`);
    }
  } catch(e) {
    console.error('cancelDuplicateSubscriptions error:', e.message);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.STRIPE_WEBHOOK_SECRET) return res.status(500).json({ error: 'Webhook secret not configured' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Database not configured' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const SK = process.env.STRIPE_SECRET_KEY;

  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  let event;
  try {
    event = constructEvent(rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
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
        const tier = (obj.status === 'active' || obj.status === 'trialing') ? tierFromPriceId(priceId) : 'free';
        await updateUserTier(supabase, obj.customer, tier, obj.id, obj.metadata);
        // Cancel any duplicate subs — only one active subscription per customer
        if (tier !== 'free' && obj.status === 'active') {
          await cancelDuplicateSubscriptions(obj.customer, obj.id, SK);
        }
        break;
      }
      case 'customer.subscription.deleted':
        await updateUserTier(supabase, obj.customer, 'free', null, obj.metadata);
        break;
      case 'invoice.payment_failed':
        await updateUserTier(supabase, obj.customer, 'free', null, null);
        break;
      case 'checkout.session.completed':
        if (obj.mode === 'subscription' && obj.subscription) {
          // Fast-path tier update — look up the actual subscription to get the correct tier
          const metaUserId = obj.metadata?.supabase_user_id || obj.client_reference_id;
          const eagerMeta = metaUserId ? { supabase_user_id: metaUserId } : null;
          let checkoutTier = 'plus'; // default fallback
          try {
            const stripe = require('../lib/stripe-client');
            const sub = await stripe.subscriptions.retrieve(obj.subscription, SK);
            const subPriceId = sub.items?.data?.[0]?.price?.id;
            if (subPriceId) checkoutTier = tierFromPriceId(subPriceId);
          } catch(e) { console.warn('Checkout tier lookup fallback:', e.message); }
          await updateUserTier(supabase, obj.customer, checkoutTier, obj.subscription, eagerMeta);
          // Cancel duplicates immediately on checkout completion
          await cancelDuplicateSubscriptions(obj.customer, obj.subscription, SK);
          console.log('Checkout fast-path for', obj.customer, 'sub', obj.subscription, 'tier', checkoutTier);
        }
        break;
    }
  } catch(e) {
    console.error('Webhook handler error:', e.message);
  }

  res.json({ received: true });
};
