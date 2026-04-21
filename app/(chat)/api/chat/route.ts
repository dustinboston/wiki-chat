import {
	type CoreMessage,
	type Message,
	convertToCoreMessages,
	createDataStreamResponse,
	streamText,
} from 'ai';
import {z} from 'zod';
import {openai} from '@ai-sdk/openai';
import {auth} from '@/app/(auth)/auth';
import {saveMessage} from '@/services/chat';
import {listFiles, getFile} from '@/services/file';
import {retrieveAndAugment} from '@/ai/rag';

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
	noteContext: z.object({
		fileId: z.number().int().positive(),
		title: z.string(),
		content: z.string(),
	}).optional(),
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

/**
 *
 * @param request Converts the messsages and selectedFileIds into a
 * @returns a Response data stream
 */
export async function POST(request: Request) {
	const json: unknown = await request.json();
	const {id, messages, selectedFileIds, noteContext} = chatRequestSchema.parse(json);

	const session = await auth();

	if (!session?.user?.email) {
		return new Response('Unauthorized', {status: 401});
	}

	const userEmail = session.user.email;

	let augmentedMessages: CoreMessage[];
	let sources: Awaited<ReturnType<typeof retrieveAndAugment>>['sources'] = [];

	if (noteContext) {
		const noteFile = await getFile({id: noteContext.fileId});
		if (!noteFile || noteFile.userEmail !== userEmail) {
			return new Response('Forbidden', {status: 403});
		}

		if (noteFile.sourceType !== 'manual' && noteFile.sourceType !== 'generated') {
			return new Response('Note context is only allowed for notes and generated files', {status: 403});
		}

		const contextPrefix: CoreMessage = {
			role: 'system',
			content: `The user is working on the note titled "${noteContext.title}". Its current contents are:\n\n${noteContext.content}\n\nWhen asked to expand, rewrite, or generate, produce a new complete note body that could replace the current contents.`,
		};
		augmentedMessages = [contextPrefix, ...convertToCoreMessages(messages)];
	} else {
		// When no files are explicitly selected, query across all of the user's files.
		let fileIds = selectedFileIds;
		if (fileIds.length === 0) {
			const userFiles = await listFiles({email: userEmail});
			fileIds = userFiles.map(f => f.id);
		}

		const ragResult = await retrieveAndAugment({
			messages: convertToCoreMessages(messages),
			fileIds,
		});
		augmentedMessages = ragResult.messages;
		sources = ragResult.sources;
	}

	return createDataStreamResponse({
		execute(dataStream) {
			if (sources.length > 0) {
				dataStream.writeMessageAnnotation({sources});
			}

			const result = streamText({
				model: openai('gpt-5.4-2026-03-05'),
				temperature: 0,
				system,
				messages: augmentedMessages,
				async onFinish({text}) {
					if (noteContext) {
						return;
					}

					await saveMessage({
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
