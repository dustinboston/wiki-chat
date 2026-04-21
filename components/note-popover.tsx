'use client';

import {useEffect} from 'react';
import useSWR from 'swr';
import {fileContentSchema} from './sidebar-context';
import {LoaderIcon} from './icons';
import {fetcher} from '@/utils/functions';

type NotePopoverProps = {
	noteFileId: number | null;
	onClose: () => void;
};

export function NotePopover({noteFileId, onClose}: NotePopoverProps) {
	const swr = useSWR<unknown, Error>(
		noteFileId === null ? null : `/api/files/content?id=${noteFileId}`,
		fetcher,
	);
	const {data, error, isLoading} = swr;

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
		<div
			className='fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-4'
			onClick={onClose}
		>
			<div
				className='w-full max-w-lg rounded-lg bg-white dark:bg-zinc-800 shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[80vh]'
				onClick={event => {
					event.stopPropagation();
				}}
			>
				<div className='flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700'>
					<h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate'>
						{title}
					</h2>
					<button
						type='button'
						onClick={onClose}
						className={
							'text-xs px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 '
							+ 'dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 '
							+ 'transition-colors flex-shrink-0 ml-3'
						}
					>
						Close
					</button>
				</div>

				<div className='flex-1 overflow-y-auto px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap'>
					{isLoading && (
						<div className='flex items-center justify-center py-6 text-zinc-400'>
							<div className='animate-spin'>
								<LoaderIcon />
							</div>
						</div>
					)}
					{error && (
						<div className='text-xs text-red-500'>Failed to load note.</div>
					)}
					{note?.content}
				</div>
			</div>
		</div>
	);
}
