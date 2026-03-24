// Delete account — removes all user data from Supabase
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  const token = authHeader.split(' ')[1];

  // Verify user via their token
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  try {
    // Delete all user data in order
    await supabase.from('entries').delete().eq('user_id', user.id);
    await supabase.from('intentions').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);

    // Delete the auth user (requires service role key)
    // Note: this requires SUPABASE_SERVICE_ROLE_KEY env var
    const adminClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteErr) {
      console.error('Auth delete error:', deleteErr.message);
      // Data deleted but auth user couldn't be removed - still a partial success
      return res.status(200).json({ 
        success: true, 
        note: 'Data deleted. Auth account removal requires admin key - contact support to complete.' 
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
