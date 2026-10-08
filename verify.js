const crypto = require('crypto');
const { markPaid } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { razorpay_order_id: o, razorpay_payment_id: p, razorpay_signature: sig } = req.body || {};
    if (!o || !p || !sig) return res.status(400).json({ error: 'Missing payment details' });
    const exp = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(o + '|' + p).digest('hex');
    const a = Buffer.from(exp), b = Buffer.from(String(sig));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ error: 'Invalid payment signature' });
    const no = await markPaid(o, p);
    if (!no) return res.status(404).json({ error: 'Registration not found' });
    res.status(200).json({ ok: true, registrationNumber: no });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
