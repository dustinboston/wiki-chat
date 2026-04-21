import process from 'node:process';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

dotenv.config({
	path: '.env.local',
});

if (!process.env.POSTGRES_URL) {
	throw new Error('POSTGRES_URL is not defined');
}

const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
const db = drizzle(connection);

console.log('Running migrations...');

const start = Date.now();

try {
	await migrate(db, { migrationsFolder: './drizzle' });
	const end = Date.now();
	console.log('Migrations completed in', end - start, 'ms');
} finally {
	await connection.end();
}
