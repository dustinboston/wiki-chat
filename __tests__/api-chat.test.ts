import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type Session} from 'next-auth';
import {POST as postChat} from '@/app/(chat)/api/chat/route';

const {mockAuth, mockStreamText, mockCreateMessage, mockRetrieveAndAugment, mockCreateDataStreamResponse} = vi.hoisted(() => ({
	mockAuth: vi.fn(),
	mockStreamText: vi.fn(),
	mockCreateMessage: vi.fn(),
	mockRetrieveAndAugment: vi.fn(),
	mockCreateDataStreamResponse: vi.fn(),
}));

vi.mock('@/app/(auth)/auth', () => ({
	auth: mockAuth,
}));

vi.mock('@/app/db', () => ({
	createMessage: mockCreateMessage.mockResolvedValue(undefined),
}));

vi.mock('@/ai/rag', () => ({
	retrieveAndAugment: mockRetrieveAndAugment,
}));

vi.mock('@ai-sdk/openai', () => ({
	openai: vi.fn().mockReturnValue('mocked-model'),
}));

vi.mock('ai', () => ({
	streamText: mockStreamText,
	createDataStreamResponse: mockCreateDataStreamResponse,
	convertToCoreMessages: (messages: unknown[]) => messages,
}));

function mockSession(email: string): Session {
	return {user: {email}, expires: '2099-01-01'};
}

describe('POST /api/chat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockRetrieveAndAugment.mockResolvedValue({messages: [], sources: []});
		mockCreateDataStreamResponse.mockImplementation(({execute}: {execute: (ds: Record<string, unknown>) => void}) => {
			const mockDataStream = {
				writeMessageAnnotation: vi.fn(),
			};

			execute(mockDataStream);
			return new Response('stream');
		});
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

	it('calls retrieveAndAugment and streamText when authenticated', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));

		const augmentedMessages = [{role: 'user', content: 'augmented'}];
		mockRetrieveAndAugment.mockResolvedValue({
			messages: augmentedMessages,
			sources: [],
		});
		mockStreamText.mockReturnValue({
			mergeIntoDataStream: vi.fn(),
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

		await postChat(request);

		expect(mockRetrieveAndAugment).toHaveBeenCalledWith({
			messages,
			fileIds: [1, 2],
		});
		expect(mockStreamText).toHaveBeenCalledWith(expect.objectContaining({
			temperature: 0,
			messages: augmentedMessages,
		}));
	});

	it('onFinish callback saves the message with source annotations', async () => {
		mockAuth.mockResolvedValue(mockSession('a@b.com'));

		const sources = [{chunkId: 'c1', fileId: 1, similarity: 0.9}];
		mockRetrieveAndAugment.mockResolvedValue({
			messages: [{role: 'user', content: 'hello'}],
			sources,
		});

		let capturedOnFinish: ((arguments_: {text: string}) => Promise<void>) | undefined;
		mockStreamText.mockImplementation((options: {onFinish?: (arguments_: {text: string}) => Promise<void>}) => {
			if (options.onFinish) {
				capturedOnFinish = options.onFinish;
			}

			return {mergeIntoDataStream: vi.fn()};
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
			messages: [...messages, {
				id: 'chat-1',
				role: 'assistant',
				content: 'AI response',
				annotations: [{sources}],
			}],
			author: 'a@b.com',
		});
	});
});
