import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  // Only serve GET requests for the root
  if (req.method !== 'GET') {
    return res.status(405).end();
  }

  try {
    let html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    // Safely inject public Supabase config
    // The anon key is safe to expose — Row Level Security protects all data
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

    html = html.replace(
      "window.SUPABASE_URL = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '';",
      `window.SUPABASE_URL = '${supabaseUrl}';`
    );
    html = html.replace(
      "window.SUPABASE_ANON_KEY = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '';",
      `window.SUPABASE_ANON_KEY = '${supabaseAnonKey}';`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).send(html);

  } catch (err) {
    console.error('Index serve error:', err);
    return res.status(500).send('Server error');
  }
}
