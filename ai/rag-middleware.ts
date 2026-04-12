import {openai} from '@ai-sdk/openai';
import {
	cosineSimilarity,
	embed,
	type Experimental_LanguageModelV1Middleware,
	generateObject,
	generateText,
} from 'ai';
import {z} from 'zod';
import {getChunksByFileIds} from '@/app/db';

// Schema for validating the custom provider metadata
const selectionSchema = z.object({
	files: z.object({
		selection: z.array(z.number()),
	}),
});

export const ragMiddleware: Experimental_LanguageModelV1Middleware = {
	async transformParams({params}) {
		const {prompt: messages, providerMetadata} = params;

		// Validate the provider metadata with Zod:
		const {success, data} = selectionSchema.safeParse(providerMetadata);

		if (!success) {
			return params;
		} // No files selected

		const {selection} = data.files;

		if (selection.length === 0) {
			return params;
		}

		const recentMessage = messages.pop();

		if (recentMessage?.role !== 'user') {
			if (recentMessage) {
				messages.push(recentMessage);
			}

			return params;
		}

		const lastUserMessageContent = recentMessage.content
			.filter(content => content.type === 'text')
			.map(content => content.text)
			.join('\n');

		// Classify the user prompt as whether it requires more context or not
		const {object: classification} = await generateObject({
			// Fast model for classification:
			model: openai('gpt-4o-mini', {structuredOutputs: true}),
			output: 'enum',
			enum: ['question', 'statement', 'other'],
			system: 'classify the user message as a question, statement, or other',
			prompt: lastUserMessageContent,
		});

		// Only use RAG for questions
		if (classification !== 'question') {
			messages.push(recentMessage);
			return params;
		}

		// Use hypothetical document embeddings:
		const {text: hypotheticalAnswer} = await generateText({
			// Fast model for generating hypothetical answer:
			model: openai('gpt-4o-mini', {structuredOutputs: true}),
			system: 'Answer the users question:',
			prompt: lastUserMessageContent,
		});

		// Embed the hypothetical answer
		const {embedding: hypotheticalAnswerEmbedding} = await embed({
			model: openai.embedding('text-embedding-3-small'),
			value: hypotheticalAnswer,
		});

		// Find relevant chunks based on the selection
		const chunksBySelection = await getChunksByFileIds({
			fileIds: selection,
		});

		const chunksWithSimilarity = chunksBySelection.map(chunk => ({
			...chunk,
			similarity: cosineSimilarity(
				hypotheticalAnswerEmbedding,
				chunk.embedding,
			),
		}));

		// Rank the chunks by similarity and take the top K
		chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);
		const k = 10;
		const topKChunks = chunksWithSimilarity.slice(0, k);

		// Add the chunks to the last user message
		messages.push({
			role: 'user',
			content: [
				...recentMessage.content,
				{
					type: 'text',
					text: 'Here is some relevant information that you can use to answer the question:',
				},
				...topKChunks.map(chunk => ({
					type: 'text' as const,
					text: chunk.content,
				})),
			],
		});

		return {...params, prompt: messages};
	},
};
