// Health check - verifies API is reachable and env vars are set
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  
  const checks = {
    api: 'ok',
    supabase_url: !!process.env.SUPABASE_URL ? 'set' : 'MISSING',
    supabase_anon_key: !!process.env.SUPABASE_ANON_KEY ? 'set' : 'MISSING',
    anthropic_key: !!process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING',
  };
  
  const allOk = Object.values(checks).every(v => v === 'ok' || v === 'set');
  
  return res.status(allOk ? 200 : 500).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    ts: new Date().toISOString(),
  });
};
