const { createClient } = require('@supabase/supabase-js');

function getSupabase(req) {
  const authHeader = req.headers.authorization;
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase(req);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found, that's ok
      return res.status(200).json({ profile: data || null });
    }

    if (req.method === 'POST') {
      const { profile } = req.body;
      if (!profile) return res.status(400).json({ error: 'Missing profile' });

      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: profile.name,
          dob: profile.dob || null,
          birth_time: profile.time || null,
          rising: profile.rising || null,
          notes: profile.notes || null,
          settings: profile.settings || {},
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, profile: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Profile API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
