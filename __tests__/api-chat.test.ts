import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type Session} from 'next-auth';
import {POST as postChat} from '@/app/(chat)/api/chat/route';
import {createMessage} from '@/app/db';

const {mockAuth, mockStreamText, mockCreateMessage} = vi.hoisted(() => ({
	mockAuth: vi.fn(),
	mockStreamText: vi.fn(),
	mockCreateMessage: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
	auth: mockAuth,
}));

vi.mock('@/app/db', () => ({
	createMessage: mockCreateMessage.mockResolvedValue(undefined),
}));

vi.mock('@/ai', () => ({
	customModel: 'mocked-model',
}));

vi.mock('ai', () => ({
	streamText: mockStreamText,
}));

function mockSession(email: string): Session {
	return {user: {email}, expires: '2099-01-01'};
}

describe('POST /api/chat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 401 when not authenticated', async () => {
		mockAuth.mockResolvedValue(null);

		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				id: '1',
				messages: [{role: 'user', content: 'hi'}],
				selectedFileIds: [],
			}),
		});

		const response = await postChat(request);
		expect(response.status).toBe(401);
		expect(await response.text()).toBe('Unauthorized');
	});

	it('calls streamText with correct parameters when authenticated', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));

		const mockResponse = new Response('streamed data');
		mockStreamText.mockReturnValue({
			toDataStreamResponse: vi.fn().mockReturnValue(mockResponse),
		});

		const messages = [{role: 'user', content: 'hello'}];
		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({
				id: 'chat-1',
				messages,
				selectedFileIds: [1, 2],
			}),
		});

		const response = await postChat(request);

		expect(mockStreamText).toHaveBeenCalledWith(expect.objectContaining({
			model: 'mocked-model',
			temperature: 0,
			messages,
			experimental_providerMetadata: {
				files: {selection: [1, 2]},
			},
		}));
		expect(response).toBe(mockResponse);
	});

	it('onFinish callback saves the message to the database', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));

		let capturedOnFinish: ((arguments_: {text: string}) => Promise<void>) | undefined;
		mockStreamText.mockImplementation((options: {onFinish?: (arguments_: {text: string}) => Promise<void>}) => {
			if (options.onFinish) {
				capturedOnFinish = options.onFinish;
			}

			return {
				toDataStreamResponse: vi.fn().mockReturnValue(new Response('ok')),
			};
		});

		const messages = [{role: 'user', content: 'hello'}];
		const request = new Request('http://localhost/api/chat', {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({id: 'chat-1', messages, selectedFileIds: []}),
		});

		await postChat(request);

		expect(capturedOnFinish).toBeDefined();
		if (capturedOnFinish) {
			await capturedOnFinish({text: 'AI response'});
		}

		expect(mockCreateMessage).toHaveBeenCalledWith({
			id: 'chat-1',
			messages: [...messages, {id: 'chat-1', role: 'assistant', content: 'AI response'}],
			author: 'a@b.com',
		});
	});
});
