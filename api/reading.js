const https = require('https');

const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + 3600000 };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + 3600000; }
  record.count++;
  rateLimitMap.set(ip, record);
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap) { if (now > v.resetAt) rateLimitMap.delete(k); }
  }
  return record.count > 15;
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(bodyStr) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Rate limit reached' });

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 3000) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await httpsPost(
      'api.anthropic.com',
      '/v1/messages',
      {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }
    );

    if (response.status !== 200) {
      let errMsg = 'Reading unavailable';
      let errDetail = '';
      try {
        const b = JSON.parse(response.body);
        errMsg = b.error?.message || b.type || errMsg;
        errDetail = JSON.stringify(b).slice(0, 200);
      } catch(e) { errDetail = response.body.slice(0, 200); }
      console.error(`Anthropic ${response.status}:`, errDetail);
      return res.status(502).json({ error: errMsg, detail: errDetail, anthropic_status: response.status });
    }

    const data = JSON.parse(response.body);
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    return res.status(200).json({ text });

  } catch (err) {
    console.error('Reading handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
