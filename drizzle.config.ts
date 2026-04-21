import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

dotenv.config({
	path: '.env.local',
});

const postgresUrl = process.env.POSTGRES_URL;
if (!postgresUrl) {
	throw new Error('POSTGRES_URL is not set in .env.local');
}

export default defineConfig({
	schema: './schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: postgresUrl,
	},
});
