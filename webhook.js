// Safety net: marks payment as paid even if the user closes the browser after paying.
const crypto = require('crypto');
const { markPaid } = require('./_lib');

function raw(req) {
  return new Promise((resolve) => {
    if (req.body !== undefined) return resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    let t = ''; req.on('data', (c) => (t += c)); req.on('end', () => resolve(t));
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const body = await raw(req);
    const exp = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    const got = String(req.headers['x-razorpay-signature'] || '');
    if (exp.length !== got.length || !crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(got))) return res.status(400).end();
    const ev = JSON.parse(body);
    if (ev.event === 'payment.captured' || ev.event === 'order.paid') {
      const pay = ev.payload.payment && ev.payload.payment.entity;
      if (pay && pay.order_id) await markPaid(pay.order_id, pay.id);
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
};
module.exports.config = { api: { bodyParser: false } };
