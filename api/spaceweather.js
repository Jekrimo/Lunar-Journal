// Proxy for NOAA Space Weather data — no API key needed
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Lunations-App/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, json: () => JSON.parse(data) }); }
        catch(e) { resolve({ ok: false, json: () => null }); }
      });
    }).on('error', reject);
  });
}

function classifyKp(kp) {
  if (kp === null || kp === undefined) return { label: 'Unknown', level: 0, color: '#666666', desc: 'Data unavailable' };
  if (kp < 2)  return { label: 'Quiet',      level: 0, color: '#4a9a6a', desc: 'Calm electromagnetic field. Clear signal.' };
  if (kp < 4)  return { label: 'Unsettled',  level: 1, color: '#8aaa4a', desc: 'Minor fluctuations. Sensitive people may notice.' };
  if (kp < 5)  return { label: 'Active',     level: 2, color: '#c9a84c', desc: 'Elevated activity. Nervous systems may feel stirred.' };
  if (kp < 6)  return { label: 'G1 Storm',   level: 3, color: '#c07030', desc: 'Minor geomagnetic storm. Sleep and mood commonly affected.' };
  if (kp < 7)  return { label: 'G2 Storm',   level: 4, color: '#c04020', desc: 'Moderate storm. High-latitude effects. Rest and ground.' };
  if (kp < 8)  return { label: 'G3 Storm',   level: 5, color: '#a02020', desc: 'Strong storm. Significant biological and electrical effects.' };
  return              { label: 'G4-G5 Storm', level: 6, color: '#800020', desc: 'Severe storm. Profound planetary electromagnetic event.' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const [kpRes, windRes] = await Promise.allSettled([
      httpsGet('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json'),
      httpsGet('https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json'),
    ]);

    let kpCurrent = null, kpMax24h = 0, kpHistory = [];
    if (kpRes.status === 'fulfilled' && kpRes.value.ok) {
      const raw = kpRes.value.json();
      if (Array.isArray(raw)) {
        const recent = raw.slice(-1440);
        kpHistory = recent
          .filter((_, i) => i % 60 === 0)
          .map(r => ({ time: r.time_tag, kp: parseFloat(r.kp_index) || 0 }));
        if (kpHistory.length) {
          kpCurrent = kpHistory[kpHistory.length - 1].kp;
          kpMax24h = Math.max(...kpHistory.map(h => h.kp));
        }
      }
    }

    let windSpeed = null, windDensity = null, bzComponent = null;
    if (windRes.status === 'fulfilled' && windRes.value.ok) {
      const raw = windRes.value.json();
      if (Array.isArray(raw) && raw.length) {
        const last = raw[raw.length - 1];
        windSpeed = last.proton_speed ? Math.round(parseFloat(last.proton_speed)) : null;
        windDensity = last.proton_density ? parseFloat(last.proton_density).toFixed(1) : null;
        bzComponent = last.bz_gsm ? parseFloat(last.bz_gsm).toFixed(1) : null;
      }
    }

    const kpClass = classifyKp(kpCurrent);
    const bzNum = bzComponent ? parseFloat(bzComponent) : null;
    const bzDesc = bzNum === null ? null :
      bzNum < -10 ? 'Strongly southward — high geoeffectiveness' :
      bzNum < -5  ? 'Southward — elevated geoeffectiveness' :
      bzNum < 0   ? 'Slightly southward' : 'Northward — low geoeffectiveness';

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      kp: {
        current: kpCurrent,
        max24h: kpMax24h,
        classification: kpClass,
        history: kpHistory.slice(-24),
      },
      solarWind: {
        speed: windSpeed,
        density: windDensity,
        bz: bzComponent,
        bzDesc,
        speedDesc: !windSpeed ? null :
          windSpeed < 400 ? 'Slow — calm conditions' :
          windSpeed < 600 ? 'Moderate — watch for effects' :
          windSpeed < 800 ? 'Fast — elevated activity likely' : 'Very fast — storm likely',
      },
      alerts: [],
    });

  } catch (err) {
    console.error('Space weather error:', err);
    return res.status(500).json({ error: 'Space weather data unavailable', details: err.message });
  }
};
