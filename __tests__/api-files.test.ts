import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type Session} from 'next-auth';
import {z} from 'zod';
import {GET as listFiles} from '@/app/(chat)/api/files/list/route';
import {GET as getContent, PATCH as patchContent} from '@/app/(chat)/api/files/content/route';
import {DELETE as deleteFile} from '@/app/(chat)/api/files/delete/route';

const {
	mockAuth, mockListFiles, mockGetFileContent, mockDeleteFile, mockReplaceFileContent,
} = vi.hoisted(() => ({
	mockAuth: vi.fn(),
	mockListFiles: vi.fn(),
	mockGetFileContent: vi.fn(),
	mockDeleteFile: vi.fn(),
	mockReplaceFileContent: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
	auth: mockAuth,
}));

vi.mock('@/services/file', () => ({
	listFiles: mockListFiles,
	getFileContent: mockGetFileContent,
	deleteFile: mockDeleteFile,
	replaceFileContent: mockReplaceFileContent,
}));

function mockSession(email: string): Session {
	return {user: {email}, expires: '2099-01-01'};
}

describe('GET /api/files/list', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const response = await listFiles();
		expect(response.status).toBe(401);
	});

	it('returns 401 when user has no email', async () => {
		mockAuth.mockResolvedValue({expires: ''});
		const response = await listFiles();
		expect(response.status).toBe(401);
	});

	it('returns mapped file list for authenticated user', async () => {
		const files = [
			{
				id: 1, pathname: 'doc.pdf', title: 'Doc', sourceType: 'upload', userEmail: 'a@b.com', createdAt: new Date(),
			},
			{
				id: 2, pathname: 'notes.txt', title: null, sourceType: 'upload', userEmail: 'a@b.com', createdAt: new Date(),
			},
		];
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockListFiles.mockResolvedValue(files);

		const response = await listFiles();
		const body: unknown = await response.json();

		expect(body).toEqual([
			{
				id: 1, pathname: 'doc.pdf', title: 'Doc', sourceType: 'upload',
			},
			{
				id: 2, pathname: 'notes.txt', title: null, sourceType: 'upload',
			},
		]);
	});
});

describe('GET /api/files/content', () => {
	beforeEach(() => vi.clearAllMocks());

	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const request = new Request('http://localhost/api/files/content?id=1');
		const response = await getContent(request);
		expect(response.status).toBe(401);
	});

	it('returns 401 when user has no email', async () => {
		mockAuth.mockResolvedValue({expires: ''});
		const request = new Request('http://localhost/api/files/content?id=1');
		const response = await getContent(request);
		expect(response.status).toBe(401);
	});

	it('returns 400 when no id provided', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const request = new Request('http://localhost/api/files/content');
		const response = await getContent(request);
		expect(response.status).toBe(400);
	});

	it('returns 400 when id is not a number', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const request = new Request('http://localhost/api/files/content?id=abc');
		const response = await getContent(request);
		expect(response.status).toBe(400);
	});

	it('returns 404 when file not found', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileContent.mockResolvedValue(null);
		const request = new Request('http://localhost/api/files/content?id=999');
		const response = await getContent(request);
		expect(response.status).toBe(404);
	});

	it('returns content from chunks', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetFileContent.mockResolvedValue({
			file: {
				id: 1, pathname: 'doc.pdf', title: null, userEmail: 'a@b.com', createdAt: new Date(),
			},
			chunks: [
				{
					id: '1/0', fileId: 1, content: 'Hello', embedding: [],
				},
				{
					id: '1/1', fileId: 1, content: 'World', embedding: [],
				},
			],
		});

		const request = new Request('http://localhost/api/files/content?id=1');
		const response = await getContent(request);
		const body = z.object({content: z.string(), truncated: z.boolean()}).parse(await response.json());

		expect(body.content).toBe('Hello\n\nWorld');
		expect(body.truncated).toBe(false);
	});

	it('truncates content exceeding 5000 words', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));

		const longContent = Array.from({length: 5500}, (unused, index) => `word${index}`).join(' ');
		mockGetFileContent.mockResolvedValue({
			file: {
				id: 1, pathname: 'doc.pdf', title: null, userEmail: 'a@b.com', createdAt: new Date(),
			},
			chunks: [
				{
					id: '1/0', fileId: 1, content: longContent, embedding: [],
				},
			],
		});

		const request = new Request('http://localhost/api/files/content?id=1');
		const response = await getContent(request);
		const body = z.object({content: z.string(), truncated: z.boolean()}).parse(await response.json());

		expect(body.truncated).toBe(true);
		expect(body.content.split(/\s+/v).length).toBe(5000);
	});
});

describe('PATCH /api/files/content', () => {
	beforeEach(() => vi.clearAllMocks());

	function patchRequest(id: string | null, body: unknown): Request {
		const url = id === null ? 'http://localhost/api/files/content' : `http://localhost/api/files/content?id=${id}`;
		return new Request(url, {
			method: 'PATCH',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify(body),
		});
	}

	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const response = await patchContent(patchRequest('1', {content: 'x'}));
		expect(response.status).toBe(401);
	});

	it('returns 400 when no id provided', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const response = await patchContent(patchRequest(null, {content: 'x'}));
		expect(response.status).toBe(400);
	});

	it('returns 400 when id is not a number', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const response = await patchContent(patchRequest('abc', {content: 'x'}));
		expect(response.status).toBe(400);
	});

	it('returns 400 when content is empty', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const response = await patchContent(patchRequest('1', {content: ''}));
		expect(response.status).toBe(400);
	});

	it('returns 404 when service reports not_found', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockReplaceFileContent.mockResolvedValue({ok: false, reason: 'not_found'});
		const response = await patchContent(patchRequest('1', {content: 'new content'}));
		expect(response.status).toBe(404);
	});

	it('returns 403 when service reports forbidden source type', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockReplaceFileContent.mockResolvedValue({ok: false, reason: 'forbidden_source_type'});
		const response = await patchContent(patchRequest('1', {content: 'new content'}));
		expect(response.status).toBe(403);
	});

	it('returns ok on success and calls service with correct args', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockReplaceFileContent.mockResolvedValue({ok: true});

		const response = await patchContent(patchRequest('42', {content: 'new body text'}));
		const body: unknown = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ok: true});
		expect(mockReplaceFileContent).toHaveBeenCalledWith({
			id: 42,
			userEmail: 'a@b.com',
			content: 'new body text',
		});
	});
});

describe('DELETE /api/files/delete', () => {
	beforeEach(() => vi.clearAllMocks());

	it('redirects when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const request = new Request('http://localhost/api/files/delete?id=1', {
			method: 'DELETE',
		});
		await expect(deleteFile(request)).rejects.toThrow();
	});

	it('redirects when user has no email', async () => {
		mockAuth.mockResolvedValue({expires: ''});
		const request = new Request('http://localhost/api/files/delete?id=1', {
			method: 'DELETE',
		});
		await expect(deleteFile(request)).rejects.toThrow();
	});

	it('returns 400 when no id provided', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const request = new Request('http://localhost/api/files/delete', {
			method: 'DELETE',
		});
		const response = await deleteFile(request);
		expect(response.status).toBe(400);
	});

	it('returns 400 for invalid id', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const request = new Request('http://localhost/api/files/delete?id=abc', {
			method: 'DELETE',
		});
		const response = await deleteFile(request);
		expect(response.status).toBe(400);
	});

	it('returns 404 when file not found or belongs to another user', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockDeleteFile.mockResolvedValue(null);
		const request = new Request('http://localhost/api/files/delete?id=99', {
			method: 'DELETE',
		});
		const response = await deleteFile(request);
		expect(response.status).toBe(404);
	});

	it('deletes file and returns empty object on success', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockDeleteFile.mockResolvedValue({
			id: 1, pathname: 'doc.pdf', title: null, userEmail: 'a@b.com', createdAt: new Date(),
		});

		const request = new Request('http://localhost/api/files/delete?id=1', {
			method: 'DELETE',
		});
		const response = await deleteFile(request);
		const body: unknown = await response.json();

		expect(mockDeleteFile).toHaveBeenCalledWith({id: 1, userEmail: 'a@b.com'});
		expect(body).toEqual({});
	});
});
