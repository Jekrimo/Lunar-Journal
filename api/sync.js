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

    const toInt = v => { const n = parseInt(v); return isNaN(n) ? null : n; };
    const toSmall = (v, min=1, max=10) => { const n = toInt(v); return n===null?null:Math.max(min,Math.min(max,n)); };
    const rows = Object.entries(entries).map(([date, entry]) => ({
      user_id: user.id,
      entry_date: date,
      energy: toSmall(entry.energy),
      mood: toSmall(entry.mood),
      clarity: toSmall(entry.clarity),
      creativity: toSmall(entry.creativity),
      qualities: Array.isArray(entry.qualities) ? entry.qualities : [],
      text: String(entry.text || '').slice(0, 10000),
      dream: String(entry.dream || '').slice(0, 5000),
      intention: String(entry.intention || '').slice(0, 2000),
      phase: entry.phase ? String(entry.phase).slice(0,50) : null,
      phase_age: toInt(entry.phaseAge),
      phase_pct: toInt(entry.phasePct),
      moon_sign: entry.moonSign ? String(entry.moonSign).slice(0,20) : null,
      sun_sign: entry.sunSign ? String(entry.sunSign).slice(0,20) : null,
      tithi: entry.tithi ? String(entry.tithi).slice(0,100) : null,
      tithi_quality: entry.tithiQuality ? String(entry.tithiQuality).slice(0,50) : null,
      nakshatra: entry.nakshatra ? String(entry.nakshatra).slice(0,50) : null,
      nakshatra_pada: toSmall(entry.nakshatraPada, 1, 4),
      vara: entry.vara ? String(entry.vara).slice(0,30) : null,
      planets: Array.isArray(entry.planets) ? entry.planets : [],
      active_transits: Array.isArray(entry.activeTransits) ? entry.activeTransits : [],
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
