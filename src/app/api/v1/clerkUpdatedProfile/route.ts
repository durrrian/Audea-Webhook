import { mongo } from "@/utils/mongo";
import { notionInternal } from "@/utils/notion";
import { stripeServer } from "@/utils/stripe";
import type { WebhookEvent } from "@clerk/clerk-sdk-node";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		await mongo.connect();

		const database = mongo.db("app-v1");
		const userCollection = database.collection("User");
		const stripeCustomerCollection = database.collection("StripeCustomer");

		const body = request.body as any;
		const evt = body.evt as WebhookEvent;

		if (evt.type === "user.updated") {
			const { data } = evt;

			const user = await userCollection.findOne({ clerkUserId: data.id });

			if (!user) return NextResponse.error();

			const email = data.email_addresses.find(
				({ id }) => id === data.primary_email_address_id
			)?.email_address;

			//it is impossible that a user can have no email
			if (!email) return NextResponse.error();

			const response = await userCollection.updateOne(
				{ _id: user._id },
				{
					email,
					firstName: data.first_name,
					lastName: data.last_name,
				}
			);

			await notionInternal.pages.update({
				page_id: user.notionPageId,
				properties: {
					Name: {
						title: [
							{
								text: {
									content: `${data.first_name} ${data.last_name}`,
								},
							},
						],
					},

					Email: {
						email,
					},

					"First Name": {
						rich_text: [
							{
								text: {
									content: data.first_name,
								},
							},
						],
					},

					"Last Name": {
						rich_text: [
							{
								text: {
									content: data.last_name,
								},
							},
						],
					},
				},
			});

			const stripeCustomer = await stripeCustomerCollection.findOne({
				clerkUserId: data.id,
			});

			if (stripeCustomer) {
				await stripeServer.customers.update(stripeCustomer.stripeCustomerId, {
					email,
					name: `${data.first_name} ${data.last_name}`,
				});

				await stripeCustomerCollection.updateOne(
					{ _id: user._id },
					{
						email,
						name: `${data.first_name} ${data.last_name}`,
					}
				);
			}

			return NextResponse.json(response);
		} else {
			return NextResponse.error();
		}
	} catch (error) {
		console.error(error);
		return NextResponse.error();
	} finally {
		await mongo.close();
	}
}
