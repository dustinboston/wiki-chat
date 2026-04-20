'use client';

import {useEffect, useRef, useState} from 'react';
import useSWR from 'swr';
import {useSidebar} from './sidebar-context';
import {LoaderIcon} from './icons';
import {NoteComposer} from './note-composer';
import {fetcher} from '@/utils/functions';

type SourceFile = {
	fileId: number;
	title: string | null;
	pathname: string;
	similarity: number;
};

type DerivedFile = {
	fileId: number;
	title: string | null;
	pathname: string;
};

type SourcesData = {
	sourceType: string;
	sources: SourceFile[];
	derived: DerivedFile[];
};

function ProvenanceInfo({fileId}: {fileId: number | null}) {
	const {data, isLoading} = useSWR<SourcesData>(
		fileId ? `/api/files/sources?id=${fileId}` : null,
		fetcher,
	);

	if (isLoading || !data) {
		return null;
	}

	const hasSources = data.sources.length > 0;
	const hasDerived = data.derived.length > 0;

	if (!hasSources && !hasDerived) {
		return null;
	}

	return (
		<div className='flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 pb-3'>
			{hasSources && (
				<div>
					<div className='font-medium text-zinc-600 dark:text-zinc-300 mb-1'>Generated from:</div>
					<ul className='space-y-0.5 pl-2 border-l border-zinc-300 dark:border-zinc-600'>
						{data.sources.map(source => (
							<li key={source.fileId} className='truncate'>
								{source.title ?? source.pathname}
							</li>
						))}
					</ul>
				</div>
			)}
			{hasDerived && (
				<div>
					<div className='font-medium text-zinc-600 dark:text-zinc-300 mb-1'>Used to generate:</div>
					<ul className='space-y-0.5 pl-2 border-l border-zinc-300 dark:border-zinc-600'>
						{data.derived.map(d => (
							<li key={d.fileId} className='truncate'>
								{d.title ?? d.pathname}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

type Selection = {
	text: string;
	top: number;
	left: number;
};

export function FileViewer() {
	const {viewingFile, isLoadingFileContent, closeFileViewer} = useSidebar();
	const bodyRef = useRef<HTMLDivElement>(null);
	const [composerState, setComposerState] = useState<{quotedText?: string} | null>(null);
	const [selection, setSelection] = useState<Selection | null>(null);

	useEffect(() => {
		if (composerState) {
			setSelection(null);
			return;
		}

		const handleSelectionChange = () => {
			const sel = globalThis.getSelection();
			if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
				setSelection(null);
				return;
			}

			const range = sel.getRangeAt(0);
			const body = bodyRef.current;
			if (!body || !body.contains(range.commonAncestorContainer)) {
				setSelection(null);
				return;
			}

			const text = sel.toString().trim();
			if (text.length === 0) {
				setSelection(null);
				return;
			}

			const rect = range.getBoundingClientRect();
			setSelection({
				text,
				top: rect.top + globalThis.scrollY - 36,
				left: rect.left + (rect.width / 2),
			});
		};

		document.addEventListener('selectionchange', handleSelectionChange);
		return () => {
			document.removeEventListener('selectionchange', handleSelectionChange);
		};
	}, [composerState]);

	if (!viewingFile && !isLoadingFileContent) {
		return null;
	}

	const fileId = viewingFile?.fileId;
	const label = viewingFile?.pathname;

	return (
		<div className='absolute inset-0 z-10 flex flex-row justify-center pb-20 h-full bg-white dark:bg-zinc-900'>
			<div className='flex flex-col w-full items-center overflow-y-auto'>
				<div className='flex items-center justify-between w-full md:w-[500px] px-4 md:px-0 pt-20 pb-4 border-b border-gray-800'>
					<h2 className='text-lg font-semibold text-zinc-800 dark:text-zinc-200 truncate'>
						{label ?? 'Loading...'}
					</h2>
					<div className='flex flex-row gap-2 flex-shrink-0 ml-4'>
						<button
							onClick={() => {
								if (fileId !== undefined) {
									setComposerState({});
								}
							}}
							disabled={fileId === undefined}
							className='text-sm px-3 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
						>
							Note
						</button>
						<button
							onClick={closeFileViewer}
							className='text-sm px-3 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors'
						>
							Close
						</button>
					</div>
				</div>

				{isLoadingFileContent
					? (
						<div className='flex items-center justify-center flex-1 text-zinc-400'>
							<div className='animate-spin'>
								<LoaderIcon />
							</div>
						</div>
					)
					: (
						<div className='flex flex-col gap-4 w-full md:w-[500px] px-4 md:px-0 py-4'>
							<ProvenanceInfo fileId={viewingFile?.fileId ?? null} />
							<div ref={bodyRef} className='text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap'>
								{viewingFile?.content}
							</div>
							{viewingFile?.truncated && (
								<div className='text-xs text-zinc-400 dark:text-zinc-500 italic'>
									Content truncated to ~5,000 words.
								</div>
							)}
						</div>
					)}
			</div>

			{selection && fileId !== undefined && (
				<button
					type='button'
					onClick={() => {
						setComposerState({quotedText: selection.text});
						globalThis.getSelection()?.removeAllRanges();
					}}
					style={{
						position: 'fixed',
						top: selection.top,
						left: selection.left,
						transform: 'translateX(-50%)',
					}}
					className='z-20 text-xs px-2 py-1 rounded-md bg-zinc-800 text-zinc-50 shadow-lg hover:bg-zinc-700 transition-colors'
				>
					Note this
				</button>
			)}

			{composerState && fileId !== undefined && (
				<NoteComposer
					parentFileId={fileId}
					parentLabel={label}
					quotedText={composerState.quotedText}
					onClose={() => {
						setComposerState(null);
					}}
				/>
			)}
		</div>
	);
}
