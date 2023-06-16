export const clerkKey =
	process.env.NODE_ENV === "production"
		? (process.env.CLERK_SECRET_KEY_PROD as string)
		: (process.env.CLERK_SECRET_KEY_DEV as string);
