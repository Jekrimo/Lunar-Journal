const { createClient } = require('@supabase/supabase-js');

function getSupabase(req) {
  const authHeader = req.headers.authorization;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    authHeader ? {
      global: { headers: { Authorization: authHeader } }
    } : {}
  );
  return supabase;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase(req);

  // Verify user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // GET /api/entries — fetch all entries for user
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Convert to the flat keyed object format the frontend expects
      const entriesMap = {};
      data.forEach(row => {
        entriesMap[row.entry_date] = {
          energy: row.energy,
          mood: row.mood,
          clarity: row.clarity,
          creativity: row.creativity,
          qualities: row.qualities || [],
          text: row.text || '',
          dream: row.dream || '',
          intention: row.intention || '',
          phase: row.phase,
          phaseAge: row.phase_age,
          phasePct: row.phase_pct,
          moonSign: row.moon_sign,
          sunSign: row.sun_sign,
          tithi: row.tithi,
          tithiQuality: row.tithi_quality,
          nakshatra: row.nakshatra,
          nakshatraPada: row.nakshatra_pada,
          vara: row.vara,
          planets: row.planets || [],
          activeTransits: row.active_transits || [],
          timestamp: row.created_at,
        };
      });

      return res.status(200).json({ entries: entriesMap });
    }

    // POST /api/entries — upsert a single entry
    if (req.method === 'POST') {
      const { date, entry } = req.body;
      if (!date || !entry) return res.status(400).json({ error: 'Missing date or entry' });

      const row = {
        user_id: user.id,
        entry_date: date,
        energy: entry.energy,
        mood: entry.mood,
        clarity: entry.clarity,
        creativity: entry.creativity,
        qualities: entry.qualities || [],
        text: entry.text || '',
        dream: entry.dream || '',
        intention: entry.intention || '',
        phase: entry.phase,
        phase_age: entry.phaseAge,
        phase_pct: entry.phasePct,
        moon_sign: entry.moonSign,
        sun_sign: entry.sunSign,
        tithi: entry.tithi,
        tithi_quality: entry.tithiQuality,
        nakshatra: entry.nakshatra,
        nakshatra_pada: entry.nakshatraPada,
        vara: entry.vara,
        planets: entry.planets || [],
        active_transits: entry.activeTransits || [],
      };

      const { data, error } = await supabase
        .from('entries')
        .upsert(row, { onConflict: 'user_id,entry_date' })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, entry: data });
    }

    // DELETE /api/entries?date=YYYY-MM-DD
    if (req.method === 'DELETE') {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: 'Missing date' });

      const { error } = await supabase
        .from('entries')
        .delete()
        .eq('user_id', user.id)
        .eq('entry_date', date);

      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Entries API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
