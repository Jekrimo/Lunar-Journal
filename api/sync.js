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
    const toStr = (v, max=10000) => v ? String(v).slice(0, max) : null;

    const rows = Object.entries(entries).map(([date, entry]) => ({
      user_id: user.id,
      entry_date: date,

      // Core metrics
      energy:     toSmall(entry.energy),
      mood:       toSmall(entry.mood),
      clarity:    toSmall(entry.clarity),
      creativity: toSmall(entry.creativity),

      // Tags and text
      qualities:  Array.isArray(entry.qualities) ? entry.qualities : [],
      text:       toStr(entry.text, 10000),
      dream:      toStr(entry.dream, 5000),
      intention:  toStr(entry.intention, 2000),
      sadhana:    toStr(entry.sadhana, 2000),

      // Lunar data
      phase:          toStr(entry.phase, 50),
      phase_age:      toInt(entry.phaseAge),
      phase_pct:      toInt(entry.phasePct),
      moon_sign:      toStr(entry.moonSign, 20),
      sun_sign:       toStr(entry.sunSign, 20),

      // Vedic
      tithi:          toStr(entry.tithi, 100),
      tithi_quality:  toStr(entry.tithiQuality, 50),
      nakshatra:      toStr(entry.nakshatra, 50),
      nakshatra_pada: toSmall(entry.nakshatraPada, 1, 4),
      vara:           toStr(entry.vara, 30),

      // Planetary
      planets:          Array.isArray(entry.planets) ? entry.planets : [],
      active_transits:  Array.isArray(entry.activeTransits) ? entry.activeTransits : [],

      // Evening check-in
      eve_energy:     toSmall(entry.eveEnergy),
      eve_mood:       toSmall(entry.eveMood),
      eve_clarity:    toSmall(entry.eveClarity),
      eve_creativity: toSmall(entry.eveCreativity),
      eve_text:       toStr(entry.eveText, 5000),
      eve_timestamp:  entry.eveTimestamp && !isNaN(new Date(entry.eveTimestamp)) ? new Date(entry.eveTimestamp).toISOString() : null,
      snapshots:      Array.isArray(entry.snapshots) ? entry.snapshots : [],
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
};
