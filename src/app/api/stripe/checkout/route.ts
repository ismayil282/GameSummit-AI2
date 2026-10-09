import { adminClient, apiError, checkOrigin, HttpError, readJson, requireFamily } from "@/lib/supabase/server";
import { stripeClient, appUrl } from "@/lib/stripe/client";
export async function POST(request: Request) {
  try {
    checkOrigin(request); const interval = (await readJson(request))?.interval;
    if (!["month", "year"].includes(interval)) throw new HttpError(400, "Choose monthly or yearly billing.");
    const { user, family } = await requireFamily(true);
    if (family.stripe_subscription_id) throw new HttpError(409, "Manage your existing subscription from Settings.");
    const stripe = stripeClient();
    const price = interval === "year" ? process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID : process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID;
    if (!price) throw new HttpError(503, "Subscription pricing is not configured.");
    let customer = family.stripe_customer_id;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email, metadata: { family_id: family.id } }, { idempotencyKey: `family-customer-${family.id}` }); customer = created.id;
      const { error } = await adminClient().from("families").update({ stripe_customer_id: customer }).eq("id", family.id); if (error) throw error;
    }
    const session = await stripe.checkout.sessions.create({ mode: "subscription", customer, client_reference_id: family.id, metadata: { family_id: family.id }, subscription_data: { metadata: { family_id: family.id } }, line_items: [{ price, quantity: 1 }], success_url: `${appUrl()}/dashboard/settings?checkout=success`, cancel_url: `${appUrl()}/pricing`, allow_promotion_codes: true }, { idempotencyKey: `checkout-${family.id}-${interval}-${Math.floor(Date.now() / 300000)}` });
    return Response.json({ url: session.url });
  } catch (error) { return apiError(error); }
}
