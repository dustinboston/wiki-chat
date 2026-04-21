import {config} from 'dotenv';
import {spawnSync} from 'node:child_process';
import postgres from 'postgres';

config({path: '.env.local'});

const confirmed = process.argv.includes('--yes');

const url = process.env.POSTGRES_URL;
if (!url) {
	throw new Error('POSTGRES_URL not set in .env.local');
}

if (!confirmed) {
	console.log('This will DROP all application tables and re-run migrations.');
	console.log('All data in User, Chat, File, Chunk, FileSource, AuditLog will be lost.');
	console.log('');
	console.log(`Target: ${url.replace(/:[^:@]*@/v, ':***@')}`);
	console.log('');
	console.log('Re-run with --yes to proceed:');
	console.log('  pnpm db:reset --yes');
	process.exit(1);
}

const sql = postgres(`${url}?sslmode=require`);

try {
	console.log('Dropping application tables...');
	await sql`DROP TABLE IF EXISTS "AuditLog" CASCADE`;
	await sql`DROP TABLE IF EXISTS "FileSource" CASCADE`;
	await sql`DROP TABLE IF EXISTS "Chunk" CASCADE`;
	await sql`DROP TABLE IF EXISTS "File" CASCADE`;
	await sql`DROP TABLE IF EXISTS "Chat" CASCADE`;
	await sql`DROP TABLE IF EXISTS "User" CASCADE`;

	console.log('Dropping drizzle migration tracking...');
	await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
} finally {
	await sql.end();
}

console.log('Running migrations...');
const result = spawnSync('pnpm', ['db:migrate'], {
	stdio: 'inherit',
	shell: true,
});

if (result.status !== 0) {
	process.exit(result.status ?? 1);
}

console.log('Database reset complete.');
