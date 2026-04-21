import { openai } from '@ai-sdk/openai';
import { type CoreMessage, embed, generateObject, generateText } from 'ai';
import { getTopChunksForFileIds } from '@/services/file';

export type SourceChunk = {
	chunkId: string;
	fileId: number;
	similarity: number;
};

export type RagResult = {
	messages: CoreMessage[];
	sources: SourceChunk[];
};

// Drop chunks below this cosine similarity to the HyDE answer; weak matches were polluting context.
const MIN_SIMILARITY = 0.4;

export async function retrieveAndAugment({
	messages,
	fileIds,
}: {
	messages: CoreMessage[];
	fileIds: number[];
}): Promise<RagResult> {
	if (fileIds.length === 0) {
		return { messages, sources: [] };
	}

	const augmented = [...messages];
	const recentMessage = augmented.pop();

	if (recentMessage?.role !== 'user') {
		if (recentMessage) {
			augmented.push(recentMessage);
		}

		return { messages: augmented, sources: [] };
	}

	const lastUserMessageContent =
		typeof recentMessage.content === 'string'
			? recentMessage.content
			: recentMessage.content
					.filter((part) => part.type === 'text')
					.map((part) => part.text)
					.join('\n');

	const { object: classification } = await generateObject({
		model: openai('gpt-4o-mini', { structuredOutputs: true }),
		output: 'enum',
		enum: ['question', 'statement', 'other'],
		system: 'classify the user message as a question, statement, or other',
		prompt: lastUserMessageContent,
	});

	if (classification !== 'question') {
		augmented.push(recentMessage);
		return { messages: augmented, sources: [] };
	}

	const { text: hypotheticalAnswer } = await generateText({
		model: openai('gpt-4o-mini', { structuredOutputs: true }),
		system: 'Answer the users question:',
		prompt: lastUserMessageContent,
	});

	const { embedding: hypotheticalAnswerEmbedding } = await embed({
		model: openai.embedding('text-embedding-3-small'),
		value: hypotheticalAnswer,
	});

	const candidateChunks = await getTopChunksForFileIds({
		fileIds,
		queryEmbedding: hypotheticalAnswerEmbedding,
		limit: 10,
	});
	const topKChunks = candidateChunks.filter((c) => c.similarity >= MIN_SIMILARITY);

	if (topKChunks.length === 0) {
		augmented.push(recentMessage);
		return { messages: augmented, sources: [] };
	}

	augmented.push({
		role: 'user',
		content: [
			...(typeof recentMessage.content === 'string'
				? [{ type: 'text' as const, text: recentMessage.content }]
				: recentMessage.content),
			{
				type: 'text',
				text: 'Here is some relevant information that you can use to answer the question:',
			},
			...topKChunks.map((chunk) => ({
				type: 'text' as const,
				text: chunk.content,
			})),
		],
	});

	const sources: SourceChunk[] = topKChunks.map((chunk) => ({
		chunkId: chunk.id,
		fileId: chunk.fileId,
		similarity: chunk.similarity,
	}));

	return { messages: augmented, sources };
}
