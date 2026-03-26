const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No auth token' });

  // Use service key for admin operations
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Verify the token first
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  try {
    // Cancel Stripe subscription if they have one
    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('stripe_subscription_id, stripe_customer_id')
          .eq('id', user.id)
          .single();

        if (profile?.stripe_subscription_id) {
          const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
          await stripe.subscriptions.cancel(profile.stripe_subscription_id);
          console.log('Cancelled subscription for', user.id);
        }
      } catch(stripeErr) {
        // Non-fatal — still delete the account
        console.warn('Could not cancel subscription:', stripeErr.message);
      }
    }

    // Delete all entries
    await supabase.from('entries').delete().eq('user_id', user.id);

    // Delete profile
    await supabase.from('profiles').delete().eq('id', user.id);

    // Delete the auth user (requires service key)
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error('Error deleting auth user:', deleteErr.message);
      return res.status(500).json({ error: 'Could not delete account: ' + deleteErr.message });
    }

    console.log('Account deleted for user:', user.id);
    res.json({ success: true });
  } catch(e) {
    console.error('delete-account error:', e.message);
    res.status(500).json({ error: e.message });
  }
};
