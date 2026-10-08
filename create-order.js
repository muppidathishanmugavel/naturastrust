const { sb } = require('./_lib');

const CAT = {
  '7km': { fee: 200, min: 16, max: 120, event: 'marathon' },
  '5km': { fee: 200, min: 7, max: 15, event: 'marathon' },
  'kids_indoor': { fee: 200, min: 3, max: 6, event: 'marathon' },
  'bodybuilding': { fee: 300, min: 10, max: 18, event: 'bodybuilding' }
};
const PH = /^[6-9]\d{9}$/;
const s = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

function ageOn(dob) {
  const b = new Date(dob), e = new Date('2026-10-25');
  if (isNaN(b)) return null;
  let a = e.getFullYear() - b.getFullYear();
  const m = e.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && e.getDate() < b.getDate())) a--;
  return a;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const d = req.body || {};
    const c = CAT[d.category];
    if (!c) return res.status(400).json({ error: 'Invalid programme' });
    const age = ageOn(d.date_of_birth);
    if (age === null || age < c.min || age > c.max) return res.status(400).json({ error: 'Age does not match the programme' });
    const row = {
      name: s(d.name, 80), gender: s(d.gender, 10), date_of_birth: s(d.date_of_birth, 10), age,
      mobile_number: s(d.mobile_number, 10), address: s(d.address, 250), taluk: s(d.taluk, 60), district: s(d.district, 60),
      emergency_contact: s(d.emergency_contact, 10), emergency_relation: s(d.emergency_relation, 40)
    };
    for (const k in row) if (row[k] === '' ) return res.status(400).json({ error: 'Please fill all fields' });
    if (!['male', 'female'].includes(row.gender)) return res.status(400).json({ error: 'Invalid gender' });
    if (!PH.test(row.mobile_number) || !PH.test(row.emergency_contact)) return res.status(400).json({ error: 'Invalid mobile number' });
    if (age < 18) {
      row.parent_guardian_name = s(d.parent_guardian_name, 80);
      row.parent_guardian_mobile = s(d.parent_guardian_mobile, 10);
      row.guardian_consent = d.guardian_consent === true;
      if (!row.parent_guardian_name || !PH.test(row.parent_guardian_mobile) || !row.guardian_consent)
        return res.status(400).json({ error: 'Parent/guardian details and consent are required' });
    }

    const auth = 'Basic ' + Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: c.fee * 100, currency: 'INR', receipt: 'nt_' + Date.now(), notes: { name: row.name, category: d.category, mobile: row.mobile_number } })
    });
    const o = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'Payment gateway error' });

    await sb('registrations', {
      method: 'POST',
      body: JSON.stringify({ ...row, category: d.category, event_type: c.event, payment_status: 'pending', payment_amount: c.fee, razorpay_order_id: o.id })
    });
    res.status(200).json({ orderId: o.id, amount: c.fee });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
