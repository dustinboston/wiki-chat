import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, fetcher } from '@/utils/functions';

describe('fetcher', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns parsed JSON on successful response', async () => {
		const data = { items: [1, 2, 3] };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				json: async () => data,
			}),
		);

		const result = await fetcher('https://example.com/api');

		expect(fetch).toHaveBeenCalledWith('https://example.com/api');
		expect(result).toEqual(data);
	});

	it('throws an error with status and info on non-ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				text: async () => 'Not found',
			}),
		);

		try {
			await fetcher('https://example.com/missing');
			expect.unreachable('Should have thrown');
		} catch (error: unknown) {
			expect(error).toBeInstanceOf(AppError);
			if (error instanceof AppError) {
				expect(error.message).toBe('An error occurred while fetching the data.');
				expect(error.status).toBe(404);
				expect(error.info).toBe('Not found');
			}
		}
	});
});
