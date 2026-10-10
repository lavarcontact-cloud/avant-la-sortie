import Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { handleStripeEvent } from "@/lib/payments";

/**
 * Webhook Stripe : signature vérifiée sur le corps brut avec
 * STRIPE_WEBHOOK_SECRET avant tout traitement. Une requête non signée ou
 * mal signée est rejetée (400) et n'a aucun effet.
 */
export async function POST(req: Request) {
  const secret = serverEnv().stripeWebhookSecret;
  if (!secret) return new Response("Webhook non configuré", { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Signature manquante", { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return new Response("Signature invalide", { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event);
    return Response.json({ received: true, result });
  } catch (e) {
    console.error("[stripe webhook]", e);
    // 500 : Stripe réessaiera automatiquement.
    return new Response("Erreur de traitement", { status: 500 });
  }
}
