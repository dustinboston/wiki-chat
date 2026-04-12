import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {
	generateObject, generateText, embed, cosineSimilarity,
} from 'ai';
import {retrieveAndAugment} from '@/ai/rag';
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

type TextPart = {type: string; text: string};

function isTextPart(part: unknown): part is TextPart {
	if (typeof part !== 'object' || part === null) {
		return false;
	}

	return 'type' in part
		&& 'text' in part
		&& (part as Record<string, unknown>).type === 'text';
}

describe('retrieveAndAugment', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns messages unchanged when fileIds is empty', async () => {
		const messages = [{role: 'user' as const, content: 'hello'}];
		const result = await retrieveAndAugment({messages, fileIds: []});
		expect(result.messages).toEqual(messages);
		expect(result.sources).toEqual([]);
	});

	it('returns messages unchanged when last message is not user role', async () => {
		const messages = [{role: 'assistant' as const, content: 'hi'}];
		const result = await retrieveAndAugment({messages, fileIds: [1]});
		expect(result.messages).toHaveLength(1);
		expect(result.messages[0].role).toBe('assistant');
		expect(result.sources).toEqual([]);
	});

	it('returns messages unchanged when messages array is empty', async () => {
		const result = await retrieveAndAugment({messages: [], fileIds: [1]});
		expect(result.messages).toHaveLength(0);
		expect(result.sources).toEqual([]);
	});

	it('returns messages unchanged when classification is not a question', async () => {
		const messages = [{role: 'user' as const, content: 'The sky is blue.'}];
		mockGenerateObject.mockResolvedValue({object: 'statement'});

		const result = await retrieveAndAugment({messages, fileIds: [1]});
		expect(result.messages).toHaveLength(1);
		expect(result.messages[0].content).toBe('The sky is blue.');
		expect(result.sources).toEqual([]);
		expect(mockGenerateText).not.toHaveBeenCalled();
	});

	it('performs RAG pipeline for questions and returns sources', async () => {
		const messages = [{role: 'user' as const, content: 'What is quantum computing?'}];

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

		const result = await retrieveAndAugment({messages, fileIds: [1, 2]});

		expect(mockGenerateObject).toHaveBeenCalledOnce();
		expect(mockGenerateText).toHaveBeenCalledOnce();
		expect(mockEmbed).toHaveBeenCalledOnce();
		expect(mockGetChunks).toHaveBeenCalledWith({fileIds: [1, 2]});

		// Check augmented messages
		const lastMessage = result.messages.at(-1);
		expect(lastMessage).toBeDefined();
		expect(lastMessage?.role).toBe('user');

		if (lastMessage && Array.isArray(lastMessage.content)) {
			const chunkTexts = lastMessage.content
				.filter(part => isTextPart(part))
				.map(part => (part as TextPart).text);

			expect(chunkTexts).toContain('Chunk A');
			expect(chunkTexts).toContain('Chunk B');
			expect(chunkTexts).toContain('Chunk C');

			// Check sorted by similarity: A(0.9) > C(0.7) > B(0.5)
			const indexA = chunkTexts.indexOf('Chunk A');
			const indexC = chunkTexts.indexOf('Chunk C');
			const indexB = chunkTexts.indexOf('Chunk B');
			expect(indexA).toBeLessThan(indexC);
			expect(indexC).toBeLessThan(indexB);
		}

		// Check sources returned
		expect(result.sources).toHaveLength(3);
		expect(result.sources[0]).toEqual({chunkId: '1/0', fileId: 1, similarity: 0.9});
		expect(result.sources[1]).toEqual({chunkId: '2/0', fileId: 2, similarity: 0.7});
		expect(result.sources[2]).toEqual({chunkId: '1/1', fileId: 1, similarity: 0.5});
	});

	it('extracts text from multi-part content on user message', async () => {
		const messages = [{
			role: 'user' as const,
			content: [
				{type: 'text' as const, text: 'What is AI?'},
				{type: 'image' as const, image: new Uint8Array()},
				{type: 'text' as const, text: 'Explain briefly.'},
			],
		}];

		mockGenerateObject.mockResolvedValue({object: 'question'});
		mockGenerateText.mockResolvedValue({text: 'AI is...'});
		mockEmbed.mockResolvedValue({embedding: [0.1]});
		mockGetChunks.mockResolvedValue([
			{
				id: '1/0', fileId: 1, content: 'Chunk A', embedding: [0.1],
			},
		]);
		mockCosineSimilarity.mockReturnValueOnce(0.9);

		const result = await retrieveAndAugment({messages, fileIds: [1]});

		// Classification prompt should join the two text parts
		expect(mockGenerateObject).toHaveBeenCalledWith(expect.objectContaining({prompt: 'What is AI?\nExplain briefly.'}));

		expect(result.sources).toHaveLength(1);
		expect(result.sources[0].chunkId).toBe('1/0');
	});

	it('limits to top 10 chunks', async () => {
		const messages = [{role: 'user' as const, content: 'What is AI?'}];

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

		const result = await retrieveAndAugment({messages, fileIds: [1]});

		expect(result.sources).toHaveLength(10);

		const lastMessage = result.messages.at(-1);
		if (lastMessage && Array.isArray(lastMessage.content)) {
			// 1 original text + 1 context header + 10 chunks = 12
			expect(lastMessage.content).toHaveLength(12);
		}
	});
});
