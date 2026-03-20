// Serves public Supabase config as a JS file
// The anon key is safe to expose client-side — RLS handles all security
// Called as <script src="/api/config"></script> from index.html

export default function handler(req, res) {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 's-maxage=3600'); // cache for 1 hour

  res.status(200).send(
    `window.SUPABASE_URL = ${JSON.stringify(url)};\nwindow.SUPABASE_ANON_KEY = ${JSON.stringify(key)};`
  );
}
