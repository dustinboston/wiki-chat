import type { Session } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as upload } from '@/app/(chat)/api/files/upload/route';

type CreateFileArgs = {
	sourceChunks: Array<{
		chunkId: string;
		fileId: number;
		similarity: number;
		quotedText?: string | null;
	}>;
	sourceType: string;
};

const {
	mockAuth,
	mockCreateFileWithChunks,
	mockGetFileById,
	mockGetChunksByFileIds,
	mockEmbedMany,
} = vi.hoisted(() => ({
	mockAuth: vi.fn(),
	mockCreateFileWithChunks: vi.fn<(args: CreateFileArgs) => Promise<{ id: number }>>(),
	mockGetFileById: vi.fn(),
	mockGetChunksByFileIds: vi.fn(),
	mockEmbedMany: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
	auth: mockAuth,
}));

vi.mock('@/services/file', () => ({
	createFileWithChunks: mockCreateFileWithChunks,
}));

vi.mock('@/app/db', () => ({
	getFileById: mockGetFileById,
	getChunksByFileIds: mockGetChunksByFileIds,
}));

vi.mock('ai', () => ({
	embedMany: mockEmbedMany,
}));

vi.mock('@ai-sdk/openai', () => ({
	openai: {
		embedding: vi.fn(() => 'mock-embedding-model'),
	},
}));

vi.mock('@vercel/blob', () => ({
	put: vi.fn(),
	del: vi.fn(),
}));

vi.mock('@/utils/pdf', () => ({
	getPdfContentFromUrl: vi.fn(),
}));

function mockSession(email: string): Session {
	return { user: { email }, expires: '2099-01-01' };
}

function jsonRequest(url: string, body: Record<string, unknown>) {
	return new Request(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

function getLastCreateFileCall(): CreateFileArgs {
	const { calls } = mockCreateFileWithChunks.mock;
	const lastCall = calls.at(-1);
	if (!lastCall) {
		throw new Error('createFileWithChunks was not called');
	}

	return lastCall[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mockEmbedMany.mockResolvedValue({ embeddings: [[0.1, 0.2]] });
	mockCreateFileWithChunks.mockImplementation(async () => ({ id: 42 }));
});

describe('POST /api/files/upload auth', () => {
	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N', { content: 'hi' }),
		);
		expect(response.status).toBe(401);
	});

	it('returns 401 when user has no email', async () => {
		mockAuth.mockResolvedValue({ expires: '2099-01-01' });
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N', { content: 'hi' }),
		);
		expect(response.status).toBe(401);
	});
});

describe('POST /api/files/upload parentFileId', () => {
	it('returns 404 when parent file missing', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileById.mockResolvedValue(null);
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'hi',
				parentFileId: 7,
			}),
		);
		expect(response.status).toBe(404);
	});

	it('returns 403 when parent file belongs to another user', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileById.mockResolvedValue({
			id: 7,
			pathname: 'p.md',
			title: null,
			userEmail: 'other@b.com',
			sourceType: 'upload',
			createdAt: new Date(),
		});
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'hi',
				parentFileId: 7,
			}),
		);
		expect(response.status).toBe(403);
	});

	it('anchors to first chunk when only parentFileId is provided', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileById.mockResolvedValue({
			id: 7,
			pathname: 'p.md',
			title: null,
			userEmail: 'a@b.com',
			sourceType: 'upload',
			createdAt: new Date(),
		});
		mockGetChunksByFileIds.mockResolvedValue([
			{
				id: '7/0',
				fileId: 7,
				content: 'First chunk text',
				embedding: [],
			},
			{
				id: '7/1',
				fileId: 7,
				content: 'Second chunk text',
				embedding: [],
			},
		]);
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'my note',
				parentFileId: 7,
			}),
		);
		expect(response.status).toBe(200);
		const call = getLastCreateFileCall();
		expect(call.sourceChunks).toEqual([
			{
				chunkId: '7/0',
				fileId: 7,
				similarity: 1,
				quotedText: null,
			},
		]);
	});

	it('anchors to matching chunks for quotedText substring match', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileById.mockResolvedValue({
			id: 7,
			pathname: 'p.md',
			title: null,
			userEmail: 'a@b.com',
			sourceType: 'upload',
			createdAt: new Date(),
		});
		mockGetChunksByFileIds.mockResolvedValue([
			{
				id: '7/0',
				fileId: 7,
				content: 'First chunk text',
				embedding: [],
			},
			{
				id: '7/1',
				fileId: 7,
				content: 'The quick brown fox jumps over',
				embedding: [],
			},
			{
				id: '7/2',
				fileId: 7,
				content: 'Another unrelated section',
				embedding: [],
			},
		]);
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'my note',
				parentFileId: 7,
				quotedText: 'The quick brown fox',
			}),
		);
		expect(response.status).toBe(200);
		const call = getLastCreateFileCall();
		expect(call.sourceChunks).toHaveLength(1);
		expect(call.sourceChunks[0].chunkId).toBe('7/1');
		expect(call.sourceChunks[0].quotedText).toBe('The quick brown fox');
	});

	it('falls back to first chunk when quotedText has no match', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileById.mockResolvedValue({
			id: 7,
			pathname: 'p.md',
			title: null,
			userEmail: 'a@b.com',
			sourceType: 'upload',
			createdAt: new Date(),
		});
		mockGetChunksByFileIds.mockResolvedValue([
			{
				id: '7/0',
				fileId: 7,
				content: 'First chunk text',
				embedding: [],
			},
			{
				id: '7/1',
				fileId: 7,
				content: 'Second chunk text',
				embedding: [],
			},
		]);
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'my note',
				parentFileId: 7,
				quotedText: 'something entirely unfindable',
			}),
		);
		expect(response.status).toBe(200);
		const call = getLastCreateFileCall();
		expect(call.sourceChunks).toEqual([
			{
				chunkId: '7/0',
				fileId: 7,
				similarity: 1,
				quotedText: 'something entirely unfindable',
			},
		]);
	});

	it('ignores client-sent sourceChunks when parentFileId is present', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileById.mockResolvedValue({
			id: 7,
			pathname: 'p.md',
			title: null,
			userEmail: 'a@b.com',
			sourceType: 'upload',
			createdAt: new Date(),
		});
		mockGetChunksByFileIds.mockResolvedValue([
			{
				id: '7/0',
				fileId: 7,
				content: 'Body',
				embedding: [],
			},
		]);
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'my note',
				parentFileId: 7,
				sourceChunks: [{ chunkId: '999/0', fileId: 999, similarity: 0.8 }],
			}),
		);
		expect(response.status).toBe(200);
		const call = getLastCreateFileCall();
		expect(call.sourceChunks).toEqual([
			{
				chunkId: '7/0',
				fileId: 7,
				similarity: 1,
				quotedText: null,
			},
		]);
	});

	it('creates note with no FileSource when parentFileId is absent', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const response = await upload(
			jsonRequest('http://localhost/api/files/upload?filename=note.md&title=N&sourceType=manual', {
				content: 'freestanding note',
			}),
		);
		expect(response.status).toBe(200);
		const call = getLastCreateFileCall();
		expect(call.sourceChunks).toEqual([]);
		expect(call.sourceType).toBe('manual');
	});
});
