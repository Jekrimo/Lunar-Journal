const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Database not configured' });

  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No auth header' });
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  // GET — fetch all people for this user
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, sun_sign, moon_sign, rising_sign, notes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ people: data });
  }

  // POST — create or update a person
  if (req.method === 'POST') {
    const person = req.body?.person || req.body;
    if (!person || !person.name) return res.status(400).json({ error: 'name required' });

    const row = {
      user_id: user.id,
      name: String(person.name).trim(),
      sun_sign: person.sunSign || null,
      moon_sign: person.moonSign || null,
      rising_sign: person.risingSign || null,
      notes: person.notes || null,
    };

    // For new people (no cloudId), use insert so Supabase generates the UUID
    // For existing people, use upsert with the known id
    let query;
    if (person.cloudId) {
      row.id = person.cloudId;
      query = supabase.from('people').upsert(row, { onConflict: 'id' });
    } else {
      query = supabase.from('people').insert(row);
    }

    const { data, error } = await query.select('id').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ id: data.id });
  }

  // DELETE — remove a person by cloud UUID (id comes as query param from frontend)
  if (req.method === 'DELETE') {
    const id = req.query?.id || req.body?.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { error } = await supabase
      .from('people')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ deleted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
