import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Client } from "@notionhq/client";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
	apiVersion: "2022-11-15",
});

const notion = new Client({
	auth: process.env.NOTION_API_KEY_AUDEA_INTERNAL as string,
});

export async function POST(request: Request) {
	const endpointSecret = process.env.STRIPE_SIGNING_WEBHOOK_SECRET!;

	const sig = request.headers.get("stripe-signature");

	const buf = await request.text();

	if (sig) {
		try {
			const event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);

			if (event.type === "charge.succeeded") {
				const data = event.data.object as Stripe.Charge;

				const customerName = await (async () => {
					if (data.customer) {
						const customerResponse = (await stripe.customers.retrieve(
							data.customer.toString()
						)) as Stripe.Customer;

						if (customerResponse) {
							return customerResponse.name!;
						} else {
							return data.billing_details.name!;
						}
					} else {
						return data.billing_details.name!;
					}
				})();

				await resend.sendEmail({
					from: "Audea (NO REPLY) <no_reply@audea.id>",
					to: data.billing_details.email!,
					subject: "Thank you for purchasing Audea!",
					html: `
					<p>Heyy ${customerName}!👋🏼</p>

				    <p>Just wanted to drop you a quick note to say a big thanks for purchasing a premium membership for Audea. It means the world to me and us here at Audea.</p>

					<p>You will receive your payment receipt in another email :)</p>

				    <p>If you have any assistance or feedback to share, just reply or write me an email. I'm just one click away!</p>
				    `,
				});
			}

			if (event.type === "checkout.session.completed") {
				const data = event.data.object as Stripe.Checkout.Session;

				const amount = data.amount_total ? data.amount_total / 100 : 0;

				const currency = data.currency;

				const customerName = data.customer_details?.name;

				const text = `Stripe payment from ${customerName} for ${currency} ${amount}`;

				await notion.pages.create({
					parent: {
						database_id: process.env.NOTION_CASHFLOW_DATABASE_ID!,
					},

					properties: {
						Name: {
							title: [
								{
									text: {
										content: "Stripe income (unadjusted)",
									},
								},
							],
						},

						Description: {
							rich_text: [
								{
									text: {
										content: text,
									},
								},
							],
						},

						Date: {
							date: {
								start: new Date().toISOString(),
							},
						},
					},
				});
			}

			return NextResponse.json({ completed: true });
		} catch (err) {
			console.error(err);
			return NextResponse.error();
		}
	} else {
		return NextResponse.error();
	}
}
