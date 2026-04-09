// Supabase Edge Function: stripe-webhook
// Listens for Stripe payment events and grants access on successful payment
// Deploy: supabase functions deploy stripe-webhook
// Set webhook endpoint in Stripe Dashboard → Developers → Webhooks:
//   URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return new Response("Payment not completed", { status: 200 });
    }

    const userId = session.client_reference_id || session.metadata?.user_id;
    if (!userId) {
      console.error("No user_id in session:", session.id);
      return new Response("No user_id", { status: 400 });
    }

    // Use service role key to bypass RLS and grant access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("profiles")
      .update({
        has_access: true,
        stripe_customer_id: session.customer as string | null,
        stripe_session_id: session.id,
      })
      .eq("id", userId);

    if (error) {
      console.error("Failed to grant access:", error);
      return new Response("DB update failed", { status: 500 });
    }

    console.log(`Access granted to user ${userId}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
