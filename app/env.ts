import {z} from 'zod';

const envSchema = z.object({
	POSTGRES_URL: z.string().min(1, 'POSTGRES_URL is required'),
	OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
	AUTH_SECRET: z.string().min(1, 'AUTH_SECRET is required'),
	BLOB_READ_WRITE_TOKEN: z.string().min(1, 'BLOB_READ_WRITE_TOKEN is required'),
});

export const env = envSchema.parse(process.env);
