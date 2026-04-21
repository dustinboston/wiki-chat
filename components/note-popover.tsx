'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/utils/functions';
import { LoaderIcon } from './icons';
import { fileContentSchema } from './sidebar-context';

type NotePopoverProps = {
	noteFileId: number | null;
	onClose: () => void;
};

export function NotePopover({ noteFileId, onClose }: NotePopoverProps) {
	const swr = useSWR<unknown, Error>(
		noteFileId === null ? null : `/api/files/content?id=${noteFileId}`,
		fetcher,
	);
	const { data, error, isLoading } = swr;

	useEffect(() => {
		if (noteFileId === null) {
			return;
		}

		const handleKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				onClose();
			}
		};

		globalThis.addEventListener('keydown', handleKey);
		return () => {
			globalThis.removeEventListener('keydown', handleKey);
		};
	}, [noteFileId, onClose]);

	if (noteFileId === null) {
		return null;
	}

	const parsed = data ? fileContentSchema.safeParse(data) : null;
	const note = parsed?.success ? parsed.data : null;
	const title = note?.title ?? note?.pathname ?? 'Note';

	return (
		<div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
			<button
				type="button"
				aria-label="Close dialog"
				className="absolute inset-0 bg-zinc-900/50"
				onClick={onClose}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
			>
				<div className="flex items-center justify-between border-zinc-200 border-b px-4 py-3 dark:border-zinc-700">
					<h2 className="truncate font-semibold text-sm text-zinc-800 dark:text-zinc-100">
						{title}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="ml-3 flex-shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
					>
						Close
					</button>
				</div>

				<div className="flex-1 overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
					{isLoading && (
						<div className="flex items-center justify-center py-6 text-zinc-400">
							<div className="animate-spin">
								<LoaderIcon />
							</div>
						</div>
					)}
					{error && <div className="text-red-500 text-xs">Failed to load note.</div>}
					{note?.content}
				</div>
			</div>
		</div>
	);
}
