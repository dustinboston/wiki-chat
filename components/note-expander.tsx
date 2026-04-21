'use client';

import {useCallback, useEffect, useMemo} from 'react';
import {generateId} from 'ai';
import {mutate} from 'swr';
import {Chat, type NoteContext} from './chat';

type NoteExpanderProps = {
	noteContext: NoteContext;
	onClose: () => void;
};

export function NoteExpander({noteContext, onClose}: NoteExpanderProps) {
	const chatId = useMemo(() => generateId(), [noteContext.fileId]);

	const onRequestOverwrite = useCallback(async (messageBody: string): Promise<boolean> => {
		const response = await fetch(`/api/files/content?id=${noteContext.fileId}`, {
			method: 'PATCH',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({content: messageBody}),
		});
		if (!response.ok) {
			return false;
		}

		await mutate(`/api/files/content?id=${noteContext.fileId}`);
		return true;
	}, [noteContext.fileId]);

	useEffect(() => {
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		globalThis.addEventListener('keydown', handleKey);
		return () => {
			globalThis.removeEventListener('keydown', handleKey);
		};
	}, [onClose]);

	return (
		<div
			className='fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-4 py-6'
			onClick={onClose}
		>
			<div
				className='w-full max-w-3xl h-[90vh] rounded-lg bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col overflow-hidden'
				onClick={event => {
					event.stopPropagation();
				}}
			>
				<div className='flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0'>
					<div className='flex flex-col min-w-0'>
						<span className='text-xs uppercase tracking-wide text-zinc-400'>Expanding</span>
						<h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate'>
							{noteContext.title}
						</h2>
					</div>
					<button
						type='button'
						onClick={onClose}
						className={
							'text-xs px-2 py-1 rounded-md flex-shrink-0 ml-3 transition-colors '
							+ 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 '
							+ 'dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-300'
						}
					>
						Close
					</button>
				</div>

				<div className='flex-1 min-h-0'>
					<Chat
						id={chatId}
						initialMessages={[]}
						noteContext={noteContext}
						ephemeral
						onRequestOverwrite={onRequestOverwrite}
					/>
				</div>
			</div>
		</div>
	);
}
