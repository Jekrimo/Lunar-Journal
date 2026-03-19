import { createClient } from '@supabase/supabase-js';

function getSupabase(req) {
  const authHeader = req.headers.authorization;
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase(req);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { entries } = req.body;
    if (!entries || typeof entries !== 'object') {
      return res.status(400).json({ error: 'Missing entries object' });
    }

    const rows = Object.entries(entries).map(([date, entry]) => ({
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
    }));

    if (rows.length === 0) {
      return res.status(200).json({ success: true, synced: 0 });
    }

    // Upsert in batches of 50
    const batchSize = 50;
    let synced = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from('entries')
        .upsert(batch, { onConflict: 'user_id,entry_date' });
      if (error) throw error;
      synced += batch.length;
    }

    return res.status(200).json({ success: true, synced });

  } catch (err) {
    console.error('Sync API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
