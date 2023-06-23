import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import * as stripeNode from "stripe";

let stripePromise: Promise<Stripe | null>;

export const stripeClient = () => {
	if (!stripePromise) {
		stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
	}
	return stripePromise;
};

export const stripeServer = new stripeNode.Stripe(
	process.env.STRIPE_SECRET_KEY!,
	{
		// https://github.com/stripe/stripe-node#configuration
		apiVersion: "2022-11-15",
	}
);
