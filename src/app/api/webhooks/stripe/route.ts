import Stripe from "stripe";
import { stripeClient } from "@/lib/stripe/client";
import { adminClient, apiError, HttpError } from "@/lib/supabase/server";
export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) throw new HttpError(400, "Webhook signature is required.");
    const stripe = stripeClient(); let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET); } catch { throw new HttpError(400, "Invalid webhook signature."); }
    let subscriptionId: string | undefined;
    if (event.type === "checkout.session.completed") { const s = event.data.object as Stripe.Checkout.Session; if (s.mode === "subscription") subscriptionId = typeof s.subscription === "string" ? s.subscription : s.subscription?.id; }
    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) subscriptionId = (event.data.object as Stripe.Subscription).id;
    if (!subscriptionId) return Response.json({ received: true });
    // Fetch current state so delayed or replayed events cannot restore an old plan.
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const allowedPrices = [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID, process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID].filter(Boolean);
    const premium = ["active", "trialing"].includes(sub.status) && sub.items.data.some(item => allowedPrices.includes(item.price.id));
    const familyId = sub.metadata.family_id;
    if (!familyId) throw new HttpError(400, "Subscription family metadata is missing.");
    const db = adminClient();
    const { data: family, error: loadError } = await db.from("families").select("stripe_customer_id,stripe_subscription_id").eq("id", familyId).single();
    if (loadError) throw loadError;
    if (family.stripe_customer_id !== customerId) throw new HttpError(400, "Billing customer mismatch.");
    if (family.stripe_subscription_id && family.stripe_subscription_id !== sub.id) return Response.json({ received: true, ignored: true });
    const { error } = await db.from("families").update({ plan_type: premium ? "premium" : "free", stripe_subscription_id: ["canceled", "incomplete_expired"].includes(sub.status) ? null : sub.id, stripe_event_created: event.created }).eq("id", familyId).lte("stripe_event_created", event.created);
    if (error) throw error;
    return Response.json({ received: true });
  } catch (error) { return apiError(error); }
}
