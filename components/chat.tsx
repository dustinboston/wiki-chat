'use client';

import {type Message} from 'ai';
import {useChat} from 'ai/react';
import {motion} from 'framer-motion';
import {LoaderIcon} from './icons';
import {useSidebar} from './sidebar-context';
import {Message as PreviewMessage} from '@/components/message';
import {useScrollToBottom} from '@/components/use-scroll-to-bottom';

function parseTitle(content: string): {title: string; body: string} {
	const idx = content.indexOf('\n\n');
	if (idx === -1) {
		return {title: '', body: content};
	}

	return {title: content.slice(0, idx).trim(), body: content.slice(idx + 2)};
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

export function Chat({
	id,
	initialMessages,
}: {
	id: string;
	initialMessages: Message[];
}) {
	const {selectedFileIds, uploadFile} = useSidebar();

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
		await uploadFile(filename, body, title || undefined);
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
