'use client';

import { generateId } from 'ai';
import { useCallback, useEffect, useMemo } from 'react';
import { mutate } from 'swr';
import { Chat, type NoteContext } from './chat';

type NoteExpanderProps = {
	noteContext: NoteContext;
	onClose: () => void;
};

export function NoteExpander({ noteContext, onClose }: NoteExpanderProps) {
	const chatId = useMemo(() => generateId(), []);

	const onRequestOverwrite = useCallback(
		async (messageBody: string): Promise<boolean> => {
			const response = await fetch(`/api/files/content?id=${noteContext.fileId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: messageBody }),
			});
			if (!response.ok) {
				return false;
			}

			await mutate(`/api/files/content?id=${noteContext.fileId}`);
			return true;
		},
		[noteContext.fileId],
	);

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
		<div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
			<button
				type="button"
				aria-label="Close dialog"
				className="absolute inset-0 bg-zinc-900/50"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
			>
				<div className="flex flex-shrink-0 items-center justify-between border-zinc-200 border-b px-4 py-3 dark:border-zinc-700">
					<div className="flex min-w-0 flex-col">
						<span className="text-xs text-zinc-400 uppercase tracking-wide">Expanding</span>
						<h2 className="truncate font-semibold text-sm text-zinc-800 dark:text-zinc-100">
							{noteContext.title}
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="ml-3 flex-shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
					>
						Close
					</button>
				</div>

				<div className="min-h-0 flex-1">
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
