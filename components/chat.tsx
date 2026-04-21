'use client';

import type { JSONValue, Message } from 'ai';
import { useChat } from 'ai/react';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import type { SourceChunk } from '@/ai/rag';
import { type AggregatedSource, Message as PreviewMessage } from '@/components/message';
import { useScrollToBottom } from '@/components/use-scroll-to-bottom';
import { fetcher } from '@/utils/functions';
import { LoaderIcon } from './icons';
import { useSidebar } from './sidebar-context';

function parseTitle(content: string): { title: string; body: string } {
	const idx = content.indexOf('\n\n');
	if (idx === -1) {
		return { title: '', body: content };
	}

	return { title: content.slice(0, idx).trim(), body: content.slice(idx + 2) };
}

type SourceAnnotation = {
	sources: SourceChunk[];
};

function isSourceAnnotation(value: JSONValue): value is SourceAnnotation {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		'sources' in value &&
		Array.isArray((value as Record<string, unknown>).sources)
	);
}

function getMessageSources(message: Message): SourceChunk[] {
	if (!message.annotations) {
		return [];
	}

	for (const annotation of message.annotations) {
		if (isSourceAnnotation(annotation)) {
			return annotation.sources;
		}
	}

	return [];
}

const suggestedActions = [
	{
		title: "What's the summary",
		label: 'of these documents?',
		action: "what's the summary of these documents?",
	},
	{
		title: 'Who is the author',
		label: 'of these documents?',
		action: 'who is the author of these documents?',
	},
];

const noteSuggestedActions = [
	{
		title: 'Expand this note',
		label: 'into a full article',
		action: 'Expand this note into a full article.',
	},
	{
		title: 'Rewrite for clarity',
		label: 'keeping the same meaning',
		action: 'Rewrite this note for clarity, keeping the same meaning.',
	},
];

type FileEntry = {
	id: number;
	pathname: string;
	title: string | undefined;
	sourceType: string;
};

function aggregateSources(
	sources: SourceChunk[],
	fileMap: Map<number, FileEntry>,
): AggregatedSource[] {
	const map = new Map<number, AggregatedSource>();
	for (const source of sources) {
		const file = fileMap.get(source.fileId);
		const name = file?.title ?? file?.pathname ?? `File ${source.fileId}`;
		const existing = map.get(source.fileId);
		if (!existing || source.similarity > existing.similarity) {
			map.set(source.fileId, { fileId: source.fileId, name, similarity: source.similarity });
		}
	}

	return [...map.values()].toSorted((a, b) => b.similarity - a.similarity);
}

export type NoteContext = {
	fileId: number;
	title: string;
	content: string;
};

export function Chat({
	id,
	initialMessages,
	noteContext,
	ephemeral = false,
	onRequestOverwrite,
}: {
	id: string;
	initialMessages: Message[];
	noteContext?: NoteContext;
	ephemeral?: boolean;
	onRequestOverwrite?: (messageBody: string) => Promise<boolean>;
}) {
	const { selectedFileIds, uploadFile } = useSidebar();

	const { data: files } = useSWR<FileEntry[]>('/api/files/list', fetcher, {
		fallbackData: [],
	});
	const fileMap = new Map((files ?? []).map((f) => [f.id, f]));

	const { messages, handleSubmit, input, setInput, append, isLoading } = useChat({
		body: { id, selectedFileIds, noteContext },
		initialMessages,
		onFinish() {
			if (ephemeral) {
				return;
			}

			const parameters = new URLSearchParams();
			for (const fid of selectedFileIds) {
				parameters.append('s', String(fid));
			}

			const qs = parameters.toString();
			globalThis.history.replaceState({}, '', `/${id}${qs ? `?${qs}` : ''}`);
		},
	});

	const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();

	const onSaveMessage = async (index: number): Promise<boolean> => {
		const message = messages[index];
		const { title, body } = parseTitle(message.content);
		const filename = `${(title ?? 'Message').replaceAll(/[^a-zA-Z\d\s]/gv, '').trim()} ${Date.now()}.md`;
		const sources = getMessageSources(message);
		const result = await uploadFile(filename, body, {
			title: title || undefined,
			sourceType: 'generated',
			sourceChunks: sources.length > 0 ? sources : undefined,
		});
		return result !== null;
	};

	const onOverwriteNote = onRequestOverwrite
		? async (index: number): Promise<boolean> => {
				const message = messages[index];
				const { body } = parseTitle(message.content);
				return onRequestOverwrite(body);
			}
		: undefined;

	return (
		<div className="flex h-full flex-row justify-center bg-white pb-20 dark:bg-zinc-900">
			<div className="flex w-full flex-col items-center justify-between gap-4">
				<div
					ref={messagesContainerRef}
					className="flex h-full w-full flex-col items-center gap-4 overflow-y-scroll"
				>
					{messages.map((message, index) => (
						<PreviewMessage
							key={message.id}
							id={index}
							role={message.role}
							content={
								message.role === 'assistant' ? parseTitle(message.content).body : message.content
							}
							sources={
								message.role === 'assistant'
									? aggregateSources(getMessageSources(message), fileMap)
									: []
							}
							isStreaming={
								isLoading && index === messages.length - 1 && message.role === 'assistant'
							}
							onSaveMessage={onSaveMessage}
							onOverwriteNote={onOverwriteNote}
						/>
					))}
					<div ref={messagesEndRef} className="min-h-[24px] min-w-[24px] flex-shrink-0" />
				</div>

				{messages.length === 0 && (
					<div className="mx-auto grid w-full gap-2 px-4 sm:grid-cols-2 md:max-w-[500px] md:px-0">
						{(noteContext ? noteSuggestedActions : suggestedActions).map(
							(suggestedAction, index) => (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.05 * index }}
									key={suggestedAction.title}
									className={index > 1 ? 'hidden sm:block' : 'block'}
								>
									<button
										type="button"
										onClick={() => {
											void append({
												role: 'user',
												content: suggestedAction.action,
											});
										}}
										className="flex w-full flex-col rounded-lg border border-zinc-200 p-2 text-left text-sm text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
									>
										<span className="font-medium">{suggestedAction.title}</span>
										<span className="text-zinc-500 dark:text-zinc-400">
											{suggestedAction.label}
										</span>
									</button>
								</motion.div>
							),
						)}
					</div>
				)}

				<form
					className="relative flex w-full max-w-[calc(100dvw-32px)] flex-row items-center gap-2 px-4 md:max-w-[500px] md:px-0"
					onSubmit={handleSubmit}
				>
					<input
						className="flex-1 rounded-md bg-zinc-100 px-2 py-1.5 pr-8 text-zinc-800 outline-none dark:bg-zinc-700 dark:text-zinc-300"
						placeholder="Send a message..."
						value={input}
						onChange={(event) => {
							setInput(event.target.value);
						}}
					/>
					{isLoading && (
						<div className="absolute right-6 animate-spin text-zinc-400 md:right-2">
							<LoaderIcon />
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
