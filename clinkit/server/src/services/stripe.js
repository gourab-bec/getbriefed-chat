// Stripe Connect service — destination charges with application_fee (platform 5%).
// Card data never touches this server (PCI SAQ-A): clients tokenize via Stripe Elements/RN SDK.
// STRIPE_MOCK=1 (default in dev) simulates the full flow deterministically.

import crypto from 'node:crypto';
import { config } from '../config.js';

let stripe = null;
async function getStripe() {
  if (config.stripe.mock) return null;
  if (!stripe) {
    const { default: Stripe } = await import('stripe');
    stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2024-06-20' });
  }
  return stripe;
}

const mockId = (p) => `${p}_mock_${crypto.randomBytes(8).toString('hex')}`;

/** Create an Express connected account for a runner (Stripe handles KYC + 1099s). */
export async function createRunnerAccount(email) {
  const s = await getStripe();
  if (!s) return { accountId: mockId('acct'), onboardingUrl: 'https://connect.stripe.com/mock-onboarding' };
  const account = await s.accounts.create({ type: 'express', email, capabilities: { transfers: { requested: true } } });
  const link = await s.accountLinks.create({
    account: account.id,
    refresh_url: `${config.corsOrigins[0]}/runner/onboarding`,
    return_url: `${config.corsOrigins[0]}/runner/dashboard`,
    type: 'account_onboarding',
  });
  return { accountId: account.id, onboardingUrl: link.url };
}

/** Authorize (manual capture) the buyer's total at bid-accept. Capture happens at delivery. */
export async function authorizePayment({ orderId, buyerTotalCents, platformFeeCents, runnerAccountId }) {
  const s = await getStripe();
  if (!s) return { paymentIntentId: mockId('pi'), clientSecret: mockId('pi_secret'), status: 'requires_capture' };
  const pi = await s.paymentIntents.create(
    {
      amount: buyerTotalCents,
      currency: 'usd',
      capture_method: 'manual',
      application_fee_amount: platformFeeCents,
      transfer_data: { destination: runnerAccountId },
      metadata: { orderId },
    },
    { idempotencyKey: `auth:${orderId}` },
  );
  return { paymentIntentId: pi.id, clientSecret: pi.client_secret, status: pi.status };
}

/** Capture at delivery; amount may differ from auth if receipt actuals changed (within auth). */
export async function capturePayment({ orderId, paymentIntentId, finalAmountCents }) {
  const s = await getStripe();
  if (!s) return { status: 'succeeded', capturedCents: finalAmountCents, transferId: mockId('tr') };
  const pi = await s.paymentIntents.capture(
    paymentIntentId,
    { amount_to_capture: finalAmountCents },
    { idempotencyKey: `capture:${orderId}` },
  );
  return { status: pi.status, capturedCents: pi.amount_received, transferId: pi.transfer_data?.destination ?? null };
}

export async function cancelPayment({ orderId, paymentIntentId }) {
  const s = await getStripe();
  if (!s) return { status: 'canceled' };
  const pi = await s.paymentIntents.cancel(paymentIntentId, { idempotencyKey: `void:${orderId}` });
  return { status: pi.status };
}

export async function refund({ orderId, paymentIntentId, amountCents }) {
  const s = await getStripe();
  if (!s) return { status: 'succeeded', refundedCents: amountCents };
  const r = await s.refunds.create(
    { payment_intent: paymentIntentId, amount: amountCents, reverse_transfer: true, refund_application_fee: true },
    { idempotencyKey: `refund:${orderId}:${amountCents}` },
  );
  return { status: r.status, refundedCents: r.amount };
}

export function verifyWebhookSignature(rawBody, signature) {
  if (config.stripe.mock) return JSON.parse(rawBody.toString());
  return getStripe().then((s) => s.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret));
}
