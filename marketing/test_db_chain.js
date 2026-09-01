// Test the 7 DB calls the freeform path makes, using service role from .env.local
// (the route uses the caller's token, but RLS for owner is the same scope)
require('dotenv').config({ path: 'C:/Users/LOGO/Desktop/octopus/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('url set:', !!url, '| service key set:', !!key);
const admin = createClient(url, key);

async function main() {
  // 1. ai_models query exactly as askAI does
  const { data: models, error: mErr } = await admin
    .from('ai_models')
    .select('id, provider, model, label')
    .eq('active', true)
    .order('rank', { ascending: true });
  console.log('ai_models error:', mErr ? JSON.stringify(mErr) : null);
  console.log('models:', models ? models.length : 0);

  const today = new Date().toISOString().slice(0, 10);
  const { data: spentRows, error: sErr } = await admin
    .from('ai_model_exhaustion')
    .select('model_id')
    .eq('usage_date', today);
  console.log('exhaustion error:', sErr ? JSON.stringify(sErr) : null);
  console.log('spent today:', spentRows ? spentRows.length : 0);
}
main().catch(e => console.error(e));
