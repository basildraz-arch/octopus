// Reproduce the freeform path against production DB with a REAL session.
// We need credentials - use a service-role client to mint nothing; instead
// call the DB functions directly as the service role to check each repo call works.
require('dotenv').config({ path: 'C:/Users/LOGO/Desktop/octopus/.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.log('missing env', !!url, !!serviceKey);
  process.exit(1);
}

const admin = createClient(url, serviceKey);

(async () => {
  // find Kiro's business or any business
  const { data: biz, error: bizErr } = await admin
    .from('businesses')
    .select('id, name')
    .limit(3);
  console.log('businesses:', bizErr ? 'ERR ' + bizErr.message : JSON.stringify(biz));

  if (!biz || !biz[0]) return;
  const businessId = biz[0].id;

  // run every call answerFromGemini makes, as the service role
  const now = new Date();
  function startOfDayISO(d){const x=new Date(d);x.setHours(0,0,0,0);return x.toISOString();}
  function endOfDayISO(d){const x=new Date(d);x.setHours(23,59,59,999);return x.toISOString();}
  function startOfWeek(d){const x=new Date(d);const diff=(x.getDay()+1)%7;x.setDate(x.getDate()-diff);return x;}

  // 1. getItemCount
  let r = await admin.from('items').select('*', { count: 'exact', head: true })
    .eq('business_id', businessId).eq('active', true);
  console.log('item_count:', r.error ? 'ERR ' + r.error.message : r.count);

  // 2. getLowStockItems
  r = await admin.from('items').select('name, stock, minimum_stock')
    .eq('business_id', businessId).eq('active', true).eq('has_stock', true);
  console.log('low_stock:', r.error ? 'ERR ' + r.error.message : (r.data||[]).length + ' rows');

  // 3. getInventoryValue
  r = await admin.rpc('inventory_value');
  console.log('inventory_value:', r.error ? 'ERR ' + r.error.message : r.data);

  // 4/5. sales today & week
  r = await admin.from('sales').select('total').eq('business_id', businessId)
    .gte('created_at', startOfDayISO(now)).lte('created_at', endOfDayISO(now));
  console.log('sales_today:', r.error ? 'ERR ' + r.error.message : (r.data||[]).length);

  // 6. expenses
  r = await admin.from('expenses').select('amount').eq('business_id', businessId)
    .gte('created_at', startOfDayISO(now)).lte('created_at', endOfDayISO(now));
  console.log('expenses:', r.error ? 'ERR ' + r.error.message : (r.data||[]).length);

  // 7. top selling (nested join)
  r = await admin.from('sales').select(`sale_items ( quantity, items ( name ) )`)
    .eq('business_id', businessId)
    .gte('created_at', startOfWeek(now).toISOString()).lte('created_at', endOfDayISO(now));
  console.log('top_selling:', r.error ? 'ERR ' + JSON.stringify(r.error).slice(0,200) : (r.data||[]).length);

  // ALSO test spend_assistant_message shape without auth:
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || serviceKey);
  const s = await anon.rpc('spend_assistant_message');
  console.log('spend without auth:', s.error ? 'ERR ' + JSON.stringify(s.error).slice(0,150) : s.data);
})();
