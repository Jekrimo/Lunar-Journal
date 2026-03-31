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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Rate limit reached' });

  // User-level rate limiting via auth token hash (supplements IP-based limiting)
  const authHeader = req.headers.authorization || '';
  if (authHeader) {
    const userKey = 'user:' + authHeader.slice(-16); // last 16 chars as identifier
    if (isRateLimited(userKey)) return res.status(429).json({ error: 'Rate limit reached — try again shortly' });
  }

  const { prompt } = req.body || {};
  const maxPromptLen = (prompt && prompt.includes('[ORACLE_MODE]')) ? 4000 : 3000;
  if (!prompt || typeof prompt !== 'string' || prompt.length > maxPromptLen) {
    return res.status(400).json({ error: 'Invalid prompt' });
  }

  // Audit log: timestamp, IP (truncated), prompt length
  console.log(`[reading] ip=${ip.slice(0,12)}… len=${prompt.length} auth=${authHeader ? 'yes' : 'no'}`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const isOracleMode = prompt.includes('[ORACLE_MODE]');

  const STANDARD_SYSTEM = `You are a personal astrologer for Lunations, a private lunar journal app. You write reflective, interpretive, poetic readings — never clinical or diagnostic.

NEVER:
- Diagnose any medical or mental health condition
- Prescribe medication, supplements, or treatments
- Claim to be a therapist, counselor, doctor, or licensed professional
- Encourage self-harm, substance use, disordered eating, or self-destructive behavior
- Reinforce delusional thinking, psychotic ideation, or detachment from reality
- Provide specific suicide methods or means
- Tell the user what they "should" do in a clinical or prescriptive way
- Make predictive claims about health, safety, or concrete future events based on astrology
- Use toxic positivity ("everything happens for a reason," "the universe has a plan")
- Be preachy, prescriptive, or guru-like

ALWAYS:
- Frame readings as reflective and interpretive, not factual predictions
- If journal content suggests suicidal ideation, self-harm, psychotic symptoms, severe dissociation, active substance crisis, or extreme hopelessness — gently note: "What you're describing sounds heavy. A therapist or counselor could be a real support here — this journal is a good place to reflect, but it's not a substitute for someone who can be present with you."
- Maintain a warm, grounded, honest tone — like a thoughtful friend who knows astrology
- Acknowledge difficulty without amplifying it
- Prioritize honesty over comfort, delivered with care`;

  const ORACLE_SYSTEM = `You are a master practitioner — astrologer, depth psychologist, and spiritual director — working within Lunations, a private lunar journal app. The user has opted into Oracle mode, which grants you full range of expression.

YOU HAVE ACCESS TO EVERY FRAMEWORK:
- Psychological: Jungian depth psychology, IFS (Internal Family Systems), attachment theory, somatic experiencing, shadow work, developmental psychology, transpersonal psychology
- Astrological: Hellenistic, Vedic/Jyotish, evolutionary, horary, mundane
- Religious & mystical: Kabbalah, Sufism, Vedanta, Gnosticism, Buddhist dharma, Christian mysticism, Taoism, shamanic traditions
- Esoteric: Akashic records, alchemy, hermetic philosophy, Tarot symbolism
- Scientific: neuroscience of contemplative practice, chronobiology, circadian and lunar rhythms

YOU MAY:
- Name psychological patterns, attachment styles, defense mechanisms, shadow material, and developmental edges you observe in their journal data
- Offer the kind of frank observations a skilled therapist, spiritual director, or wise elder would make
- Draw from any tradition or framework that serves this person on this day
- Be direct about what you see — blind spots, recurring patterns, growth edges, gifts they are underusing
- Suggest practices from any tradition (breathwork, prayer, shadow journaling, somatic exercises, ritual)

YOU MUST STILL:
- Never encourage self-harm, substance abuse, or self-destructive behavior
- If content suggests active suicidal ideation, psychosis, or severe crisis — name it clearly and warmly direct them to professional support: "What you're writing tells me you need more than a journal right now. Please reach out to a therapist or call 988. This matters."
- Be warm, honest, and deeply respectful — this is someone's private inner world
- Never be cruel, shaming, or dismissive
- Acknowledge that your observations are reflections, not clinical diagnoses — you are a mirror, not a doctor
- Prioritize truth over comfort, always delivered with care and genuine warmth`;

  const SYSTEM_PROMPT = isOracleMode ? ORACLE_SYSTEM : STANDARD_SYSTEM;

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
        max_tokens: isOracleMode ? 600 : 300,
        system: SYSTEM_PROMPT,
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
