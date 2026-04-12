'use client';

import {type Message, type JSONValue} from 'ai';
import {useChat} from 'ai/react';
import {motion} from 'framer-motion';
import useSWR from 'swr';
import {LoaderIcon} from './icons';
import {useSidebar} from './sidebar-context';
import {Message as PreviewMessage, type AggregatedSource} from '@/components/message';
import {useScrollToBottom} from '@/components/use-scroll-to-bottom';
import type {SourceChunk} from '@/ai/rag';
import {fetcher} from '@/utils/functions';

function parseTitle(content: string): {title: string; body: string} {
	const idx = content.indexOf('\n\n');
	if (idx === -1) {
		return {title: '', body: content};
	}

	return {title: content.slice(0, idx).trim(), body: content.slice(idx + 2)};
}

type SourceAnnotation = {
	sources: SourceChunk[];
};

function isSourceAnnotation(value: JSONValue): value is SourceAnnotation {
	return typeof value === 'object'
		&& value !== null
		&& !Array.isArray(value)
		&& 'sources' in value
		&& Array.isArray((value as Record<string, unknown>).sources);
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
		title: 'What\'s the summary',
		label: 'of these documents?',
		action: 'what\'s the summary of these documents?',
	},
	{
		title: 'Who is the author',
		label: 'of these documents?',
		action: 'who is the author of these documents?',
	},
];

type FileEntry = {
	id: number;
	pathname: string;
	title: string | undefined;
	sourceType: string;
};

function aggregateSources(sources: SourceChunk[], fileMap: Map<number, FileEntry>): AggregatedSource[] {
	const map = new Map<number, AggregatedSource>();
	for (const source of sources) {
		const file = fileMap.get(source.fileId);
		const name = file?.title ?? file?.pathname ?? `File ${source.fileId}`;
		const existing = map.get(source.fileId);
		if (!existing || source.similarity > existing.similarity) {
			map.set(source.fileId, {fileId: source.fileId, name, similarity: source.similarity});
		}
	}

	return [...map.values()].toSorted((a, b) => b.similarity - a.similarity);
}

export function Chat({
	id,
	initialMessages,
}: {
	id: string;
	initialMessages: Message[];
}) {
	const {selectedFileIds, uploadFile} = useSidebar();

	const {data: files} = useSWR<FileEntry[]>('/api/files/list', fetcher, {
		fallbackData: [],
	});
	const fileMap = new Map((files ?? []).map(f => [f.id, f]));

	const {messages, handleSubmit, input, setInput, append, isLoading}
		= useChat({
			body: {id, selectedFileIds},
			initialMessages,
			onFinish() {
				const parameters = new URLSearchParams();
				for (const fid of selectedFileIds) {
					parameters.append('s', String(fid));
				}

				const qs = parameters.toString();
				globalThis.history.replaceState({}, '', `/${id}${qs ? `?${qs}` : ''}`);
			},
		});

	const [messagesContainerRef, messagesEndRef]
		= useScrollToBottom<HTMLDivElement>();

	const onSaveMessage = async (index: number) => {
		const message = messages[index];
		const {title, body} = parseTitle(message.content);
		const filename = `${(title ?? 'Message').replaceAll(/[^a-zA-Z\d\s]/gv, '').trim()} ${Date.now()}.md`;
		const sources = getMessageSources(message);
		await uploadFile(filename, body, {
			title: title || undefined,
			sourceType: 'generated',
			sourceChunks: sources.length > 0 ? sources : undefined,
		});
	};

	return (
		<div className='flex flex-row justify-center pb-20 h-full bg-white dark:bg-zinc-900'>
			<div className='flex flex-col justify-between items-center gap-4 w-full'>
				<div
					ref={messagesContainerRef}
					className='flex flex-col gap-4 h-full w-full items-center overflow-y-scroll'
				>
					{messages.map((message, index) => (
						<PreviewMessage
							key={`${id}-${index}`}
							id={index}
							role={message.role}
							content={
								message.role === 'assistant'
									? parseTitle(message.content).body
									: message.content
							}
							sources={message.role === 'assistant' ? aggregateSources(getMessageSources(message), fileMap) : []}
							onSaveMessage={(index: number) => {
								void onSaveMessage(index);
							}}
						/>
					))}
					<div
						ref={messagesEndRef}
						className='flex-shrink-0 min-w-[24px] min-h-[24px]'
					/>
				</div>

				{messages.length === 0 && (
					<div className='grid sm:grid-cols-2 gap-2 w-full px-4 md:px-0 mx-auto md:max-w-[500px]'>
						{suggestedActions.map((suggestedAction, index) => (
							<motion.div
								initial={{opacity: 0, y: 20}}
								animate={{opacity: 1, y: 0}}
								transition={{delay: 0.05 * index}}
								key={index}
								className={index > 1 ? 'hidden sm:block' : 'block'}
							>
								<button
									onClick={() => {
										void append({
											role: 'user',
											content: suggestedAction.action,
										});
									}}
									className='w-full text-left border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 rounded-lg p-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex flex-col' // eslint-disable-line @stylistic/max-len
								>
									<span className='font-medium'>{suggestedAction.title}</span>
									<span className='text-zinc-500 dark:text-zinc-400'>
										{suggestedAction.label}
									</span>
								</button>
							</motion.div>
						))}
					</div>
				)}

				<form
					className='flex flex-row gap-2 relative items-center w-full md:max-w-[500px] max-w-[calc(100dvw-32px)] px-4 md:px-0'
					onSubmit={handleSubmit}
				>
					<input
						className='bg-zinc-100 rounded-md px-2 py-1.5 flex-1 outline-none dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 pr-8'
						placeholder='Send a message...'
						value={input}
						onChange={event => {
							setInput(event.target.value);
						}}
					/>
					{isLoading && (
						<div className='absolute right-6 md:right-2 text-zinc-400 animate-spin'>
							<LoaderIcon />
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
