import { Client } from "@notionhq/client";

export const notionInternal = new Client({
	auth: process.env.NOTION_API_KEY_AUDEA_INTERNAL as string,
});
