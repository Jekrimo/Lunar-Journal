// Proxy for Schumann resonance spectrogram images
// Caches successful fetches so the image survives source outages
const https = require('https');

// In-memory cache (survives across warm invocations on Vercel)
let cachedImage = null;   // { buffer: Buffer, contentType: string, timestamp: number }
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Sources to try in order
const SOURCES = [
  'https://sosrff.tsu.ru/new/shm.jpg',
  'https://sosrff.tsu.ru/new/sra.jpg',
];

function fetchImage(url, timeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeout);
    const req = https.get(url, {
      headers: { 'User-Agent': 'Lunations-App/1.0' },
      timeout: timeout,
    }, (res) => {
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const ct = res.headers['content-type'] || 'image/jpeg';
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        // Sanity check: must be a real image (> 1KB)
        if (buf.length < 1024) return reject(new Error('Image too small'));
        resolve({ buffer: buf, contentType: ct });
      });
      res.on('error', (err) => { clearTimeout(timer); reject(err); });
    });
    req.on('error', (err) => { clearTimeout(timer); reject(err); });
    req.on('timeout', () => { req.destroy(); clearTimeout(timer); reject(new Error('timeout')); });
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const force = req.query && req.query.force === '1';

  // Return cache if fresh and not forced
  if (!force && cachedImage && (Date.now() - cachedImage.timestamp < CACHE_TTL)) {
    res.setHeader('Content-Type', cachedImage.contentType);
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.setHeader('X-Schumann-Source', 'cache');
    res.setHeader('X-Schumann-Age', String(Math.round((Date.now() - cachedImage.timestamp) / 1000)));
    return res.status(200).end(cachedImage.buffer);
  }

  // Try each source
  for (const url of SOURCES) {
    try {
      const img = await fetchImage(url, 8000);
      cachedImage = { buffer: img.buffer, contentType: img.contentType, timestamp: Date.now() };
      res.setHeader('Content-Type', img.contentType);
      res.setHeader('Cache-Control', 'public, max-age=900');
      res.setHeader('X-Schumann-Source', url);
      return res.status(200).end(img.buffer);
    } catch (e) {
      // Try next source
    }
  }

  // All sources failed — serve stale cache if available (up to 24 hours old)
  if (cachedImage && (Date.now() - cachedImage.timestamp < 24 * 60 * 60 * 1000)) {
    res.setHeader('Content-Type', cachedImage.contentType);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('X-Schumann-Source', 'stale-cache');
    res.setHeader('X-Schumann-Age', String(Math.round((Date.now() - cachedImage.timestamp) / 1000)));
    return res.status(200).end(cachedImage.buffer);
  }

  // Nothing available
  return res.status(503).json({ error: 'Schumann spectrogram unavailable from all sources' });
};
