// api/create-checkout.js
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
export default async function handler(req, res) {
  const { priceId, userId, email } = req.body;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    metadata: { userId },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://lunations.app/app?upgraded=1',
    cancel_url: 'https://lunations.app/app',
  });
  res.json({ url: session.url });
}