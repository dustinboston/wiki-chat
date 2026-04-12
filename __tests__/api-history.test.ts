import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type Session} from 'next-auth';
import {GET as getHistory, DELETE as deleteHistory} from '@/app/(chat)/api/history/route';
import {type Chat} from '@/schema';

const {
	mockAuth, mockGetChatsByUser, mockGetChatById, mockDeleteChatById,
} = vi.hoisted(() => ({
	mockAuth: vi.fn(),
	mockGetChatsByUser: vi.fn(),
	mockGetChatById: vi.fn(),
	mockDeleteChatById: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
	auth: mockAuth,
}));

vi.mock('@/app/db', () => ({
	getChatsByUser: mockGetChatsByUser,
	getChatById: mockGetChatById,
	deleteChatById: mockDeleteChatById,
}));

function mockSession(email: string): Session {
	return {user: {email}, expires: '2099-01-01'};
}

describe('GET /api/history', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const response = await getHistory();
		expect(response.status).toBe(401);
	});

	it('returns 401 when session has no user', async () => {
		mockAuth.mockResolvedValue({expires: ''});
		const response = await getHistory();
		expect(response.status).toBe(401);
	});

	it('returns chats for authenticated user', async () => {
		const now = new Date();
		const chats: Chat[] = [{
			id: '1', author: 'a@b.com', messages: [], createdAt: now,
		}];
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetChatsByUser.mockResolvedValue(chats);

		const response = await getHistory();
		const body: unknown = await response.json();

		expect(mockGetChatsByUser).toHaveBeenCalledWith({email: 'a@b.com'});
		expect(body).toEqual([{
			id: '1', author: 'a@b.com', messages: [], createdAt: now.toISOString(),
		}]);
	});
});

describe('DELETE /api/history', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);
		const request = new Request('http://localhost/api/history?id=1');
		const response = await deleteHistory(request);
		expect(response.status).toBe(401);
	});

	it('returns 400 when no id provided', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		const request = new Request('http://localhost/api/history');
		const response = await deleteHistory(request);
		expect(response.status).toBe(400);
	});

	it('returns 404 when chat not found', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetChatById.mockResolvedValue(undefined);
		const request = new Request('http://localhost/api/history?id=999');
		const response = await deleteHistory(request);
		expect(response.status).toBe(404);
	});

	it('returns 404 when chat belongs to another user', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetChatById.mockResolvedValue({
			id: '1', author: 'other@b.com', messages: [], createdAt: new Date(),
		});
		const request = new Request('http://localhost/api/history?id=1');
		const response = await deleteHistory(request);
		expect(response.status).toBe(404);
	});

	it('deletes chat and returns empty object on success', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));
		mockGetChatById.mockResolvedValue({
			id: '1', author: 'a@b.com', messages: [], createdAt: new Date(),
		});
		mockDeleteChatById.mockResolvedValue([]);

		const request = new Request('http://localhost/api/history?id=1');
		const response = await deleteHistory(request);
		const body: unknown = await response.json();

		expect(mockDeleteChatById).toHaveBeenCalledWith({id: '1'});
		expect(body).toEqual({});
	});
});
