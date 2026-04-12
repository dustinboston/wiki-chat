import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
	type LanguageModelV1Prompt,
	generateObject, generateText, embed, cosineSimilarity,
} from 'ai';
import {ragMiddleware} from '@/ai/rag-middleware';
import {getChunksByFileIds} from '@/app/db';

const {
	mockGetChunks,
	mockGenerateObject,
	mockGenerateText,
	mockEmbed,
	mockCosineSimilarity,
} = vi.hoisted(() => ({
	mockGetChunks: vi.fn(),
	mockGenerateObject: vi.fn(),
	mockGenerateText: vi.fn(),
	mockEmbed: vi.fn(),
	mockCosineSimilarity: vi.fn(),
}));

vi.mock('@/app/db', () => ({
	getChunksByFileIds: mockGetChunks,
}));

vi.mock('@ai-sdk/openai', () => ({
	openai: Object.assign(vi.fn().mockReturnValue('mock-chat-model'), {
		embedding: vi.fn().mockReturnValue('mock-embedding-model'),
	}),
}));

vi.mock('ai', () => ({
	generateObject: mockGenerateObject,
	generateText: mockGenerateText,
	embed: mockEmbed,
	cosineSimilarity: mockCosineSimilarity,
}));

const transformParameters = ragMiddleware.transformParams;

function makeUserMessage(text: string) {
	return {
		role: 'user' as const,
		content: [{type: 'text' as const, text}],
	};
}

function makeParameters(
	messages: LanguageModelV1Prompt,
	fileIds?: number[],
) {
	return {
		type: 'generate' as const,
		params: {
			inputFormat: 'messages' as const,
			mode: {type: 'regular' as const},
			prompt: [...messages],
			providerMetadata: fileIds
				? {files: {selection: fileIds}}
				: undefined,
		},
	};
}

type TextPart = {type: string; text: string};

function isTextPart(part: unknown): part is TextPart {
	if (typeof part !== 'object' || part === null) {
		return false;
	}

	return 'type' in part
		&& 'text' in part
		&& (part as Record<string, unknown>).type === 'text';
}

describe('ragMiddleware.transformParams', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns params unchanged when no provider metadata', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const message = makeUserMessage('hello');
		const input = makeParameters([message]);
		const result = await transformParameters(input);
		expect(result).toBe(input.params);
	});

	it('returns params unchanged when selection is empty', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const message = makeUserMessage('hello');
		const input = makeParameters([message], []);
		const result = await transformParameters(input);
		expect(result).toBe(input.params);
	});

	it('returns params unchanged when last message is not user role', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const message = {role: 'assistant' as const, content: [{type: 'text' as const, text: 'hi'}]};
		const input = makeParameters([message], [1]);
		const result = await transformParameters(input);
		expect(result.prompt).toHaveLength(1);
		expect(result.prompt[0].role).toBe('assistant');
	});

	it('returns params unchanged when messages array is empty', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const input = makeParameters([], [1]);
		const result = await transformParameters(input);
		expect(result.prompt).toHaveLength(0);
	});

	it('returns params unchanged when classification is not a question', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const message = makeUserMessage('The sky is blue.');
		const input = makeParameters([message], [1]);

		mockGenerateObject.mockResolvedValue({object: 'statement'});

		const result = await transformParameters(input);
		expect(result.prompt).toHaveLength(1);
		expect(result.prompt[0].content).toEqual(message.content);
		expect(mockGenerateText).not.toHaveBeenCalled();
	});

	it('performs RAG pipeline for questions', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const message = makeUserMessage('What is quantum computing?');
		const input = makeParameters([message], [1, 2]);

		mockGenerateObject.mockResolvedValue({object: 'question'});
		mockGenerateText.mockResolvedValue({text: 'Quantum computing uses qubits...'});
		mockEmbed.mockResolvedValue({embedding: [0.1, 0.2, 0.3]});
		mockGetChunks.mockResolvedValue([
			{
				id: '1/0', fileId: 1, content: 'Chunk A', embedding: [0.1, 0.2, 0.3],
			},
			{
				id: '1/1', fileId: 1, content: 'Chunk B', embedding: [0.4, 0.5, 0.6],
			},
			{
				id: '2/0', fileId: 2, content: 'Chunk C', embedding: [0.7, 0.8, 0.9],
			},
		]);

		mockCosineSimilarity
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.5)
			.mockReturnValueOnce(0.7);

		const result = await transformParameters(input);

		expect(mockGenerateObject).toHaveBeenCalledOnce();
		expect(mockGenerateText).toHaveBeenCalledOnce();
		expect(mockEmbed).toHaveBeenCalledOnce();
		expect(mockGetChunks).toHaveBeenCalledWith({fileIds: [1, 2]});

		const lastMessage = result.prompt.at(-1);
		expect(lastMessage).toBeDefined();
		expect(lastMessage?.role).toBe('user');

		if (lastMessage && Array.isArray(lastMessage.content)) {
			expect(lastMessage.content).toHaveLength(5);

			const chunkTexts = lastMessage.content
				.filter(part => isTextPart(part))
				.map(part => (part as TextPart).text);

			expect(chunkTexts).toContain('Chunk A');
			expect(chunkTexts).toContain('Chunk B');
			expect(chunkTexts).toContain('Chunk C');

			const indexA = chunkTexts.indexOf('Chunk A');
			const indexC = chunkTexts.indexOf('Chunk C');
			const indexB = chunkTexts.indexOf('Chunk B');
			expect(indexA).toBeLessThan(indexC);
			expect(indexC).toBeLessThan(indexB);
		}
	});

	it('limits to top 10 chunks', async () => {
		if (!transformParameters) {
			throw new Error('transformParams not defined');
		}

		const message = makeUserMessage('What is AI?');
		const fileIds = [1];
		const input = makeParameters([message], fileIds);

		mockGenerateObject.mockResolvedValue({object: 'question'});
		mockGenerateText.mockResolvedValue({text: 'AI is...'});
		mockEmbed.mockResolvedValue({embedding: [0.1]});

		const chunks = Array.from({length: 15}, (unused, index) => ({
			id: `1/${index}`,
			fileId: 1,
			content: `Chunk ${index}`,
			embedding: [index * 0.1],
		}));
		mockGetChunks.mockResolvedValue(chunks);

		for (const index of chunks.keys()) {
			mockCosineSimilarity.mockReturnValueOnce(1 - (index * 0.05));
		}

		const result = await transformParameters(input);
		const lastMessage = result.prompt.at(-1);

		if (lastMessage && Array.isArray(lastMessage.content)) {
			expect(lastMessage.content).toHaveLength(12);
		}
	});
});
