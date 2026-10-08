const SB = process.env.SUPABASE_URL;
const SK = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path, opt = {}) {
  const r = await fetch(SB + '/rest/v1/' + path, {
    ...opt,
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opt.headers || {}) }
  });
  const t = await r.text();
  let j; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Error('DB: ' + ((j && j.message) || t));
  return j;
}

// Marks a pending/failed registration as paid. Returns registration number (or null).
async function markPaid(orderId, paymentId) {
  const o = encodeURIComponent(orderId);
  const rows = await sb('registrations?razorpay_order_id=eq.' + o + '&payment_status=in.(pending,failed)', {
    method: 'PATCH',
    body: JSON.stringify({ payment_status: 'paid', payment_reference: paymentId, payment_date: new Date().toISOString() })
  });
  if (rows && rows.length) return rows[0].registration_number;
  const ex = await sb('registrations?select=registration_number,payment_status&razorpay_order_id=eq.' + o);
  return ex && ex[0] && ['paid', 'manually_verified'].includes(ex[0].payment_status) ? ex[0].registration_number : null;
}

module.exports = { sb, markPaid };
