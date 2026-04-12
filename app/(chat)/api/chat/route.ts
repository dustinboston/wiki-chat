import {
	type Message,
	convertToCoreMessages,
	createDataStreamResponse,
	streamText,
} from 'ai';
import {z} from 'zod';
import {openai} from '@ai-sdk/openai';
import {auth} from '@/app/(auth)/auth';
import {createMessage} from '@/app/db';
import {retrieveAndAugment, type SourceChunk} from '@/ai/rag';

function isMessage(item: unknown): item is Message {
	return typeof item === 'object'
		&& item !== null
		&& 'role' in item
		&& 'content' in item;
}

function isMessageArray(value: unknown): value is Message[] {
	return Array.isArray(value) && value.every(item => isMessage(item));
}

const chatRequestSchema = z.object({
	id: z.string(),
	messages: z.custom<Message[]>(isMessageArray),
	selectedFileIds: z.array(z.number()),
});

const system = `
You are an expert researcher. Keep your responses concise and helpful.

Your job is to answer the users question in the form of a brief article.
Articles should be four paragraphs, unless the user asks a simple question
that can be answered in a sentence or less. Use the documents that you have as
a primary source, filling in gaps with your own knowledge of a topic.

Once you have completed the article, examine it closely for inaccurate or false
statements. You must ensure that it is factually correct. Do not make up answers.
Do not omit relevant details.

Do not address the user directly or acknowledge the question. Simply respond
with the article, which should stand on its own.

IMPORTANT: Always format your response as follows:
- Line 1 must be a short title (5 words or fewer) summarizing your answer.
- Line 2 must be a blank line.
- Line 3 onward is the actual response content. Four paragraphs or less.
`;

export async function POST(request: Request) {
	const json: unknown = await request.json();
	const {id, messages, selectedFileIds} = chatRequestSchema.parse(json);

	const session = await auth();

	if (!session?.user?.email) {
		return new Response('Unauthorized', {status: 401});
	}

	const userEmail = session.user.email;

	// Run RAG retrieval to get augmented messages and source chunks
	const {messages: augmentedMessages, sources} = await retrieveAndAugment({
		messages: convertToCoreMessages(messages),
		fileIds: selectedFileIds,
	});

	return createDataStreamResponse({
		execute(dataStream) {
			// Write source annotations so the client can display them
			if (sources.length > 0) {
				dataStream.writeMessageAnnotation({sources});
			}

			const result = streamText({
				model: openai('gpt-5.4-2026-03-05'),
				temperature: 0,
				system,
				messages: augmentedMessages,
				async onFinish({text}) {
					await createMessage({
						id,
						messages: [
							...messages,
							{
								id,
								role: 'assistant' as const,
								content: text,
								annotations: sources.length > 0 ? [{sources}] : undefined,
							},
						],
						author: userEmail,
					});
				},
				experimental_telemetry: {
					isEnabled: true,
					functionId: 'stream-text',
				},
			});

			result.mergeIntoDataStream(dataStream);
		},
	});
}
