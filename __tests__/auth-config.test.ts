import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { describe, expect, it } from 'vitest';
import { authConfig } from '@/app/(auth)/auth.config';

const { authorized } = authConfig.callbacks;

async function callAuthorized(pathname: string, loggedIn: boolean) {
	const request = new NextRequest(new URL(`http://localhost${pathname}`));
	const auth: Session | null = loggedIn
		? { user: { email: 'test@test.com' }, expires: '2099-01-01' }
		: null;
	return authorized({ auth, request });
}

describe('auth.config authorized callback', () => {
	describe('logged-in user', () => {
		it('redirects away from /login to /', async () => {
			const result = await callAuthorized('/login', true);
			expect(result).toBeInstanceOf(Response);
			if (result instanceof Response) {
				expect(result.headers.get('location')).toBe('http://localhost/');
			}
		});

		it('redirects away from /register to /', async () => {
			const result = await callAuthorized('/register', true);
			expect(result).toBeInstanceOf(Response);
			if (result instanceof Response) {
				expect(result.headers.get('location')).toBe('http://localhost/');
			}
		});

		it('allows access to chat pages', async () => {
			expect(await callAuthorized('/', true)).toBe(true);
		});

		it('allows access to chat with id', async () => {
			expect(await callAuthorized('/abc-123', true)).toBe(true);
		});
	});

	describe('unauthenticated user', () => {
		it('allows access to /login', async () => {
			expect(await callAuthorized('/login', false)).toBe(true);
		});

		it('allows access to /register', async () => {
			expect(await callAuthorized('/register', false)).toBe(true);
		});

		it('denies access to / (chat root)', async () => {
			expect(await callAuthorized('/', false)).toBe(false);
		});

		it('denies access to /some-chat-id', async () => {
			expect(await callAuthorized('/some-chat-id', false)).toBe(false);
		});
	});
});
