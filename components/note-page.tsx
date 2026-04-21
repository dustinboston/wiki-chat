'use client';

import {
	Fragment, useEffect, useRef, useState,
} from 'react';
import {useRouter} from 'next/navigation';
import useSWR from 'swr';
import {fileContentSchema} from './sidebar-context';
import {LoaderIcon} from './icons';
import {NoteComposer} from './note-composer';
import {NotePopover} from './note-popover';
import {NoteExpander} from './note-expander';
import {pushRecentNote} from '@/hooks/use-recently-viewed';
import {fetcher} from '@/utils/functions';

type SourceFile = {
	fileId: number;
	title: string | null;
	pathname: string;
	similarity: number;
};

type Highlight = {
	quotedText: string | null;
	sourceChunkId: string;
};

type DerivedFile = {
	fileId: number;
	title: string | null;
	pathname: string;
	sourceType: 'upload' | 'generated' | 'manual';
	highlights: Highlight[];
};

type SourcesData = {
	sourceType: string;
	sources: SourceFile[];
	derived: DerivedFile[];
};

type HighlightSpan = {
	start: number;
	end: number;
	noteFileId: number;
};

export function computeHighlightSpans(
	content: string,
	highlights: Array<{quotedText: string; noteFileId: number}>,
): HighlightSpan[] {
	const lower = content.toLowerCase();
	const all: HighlightSpan[] = [];

	for (const h of highlights) {
		const needle = h.quotedText.toLowerCase();
		if (needle.length === 0) {
			continue;
		}

		let from = 0;
		while (from <= lower.length - needle.length) {
			const index = lower.indexOf(needle, from);
			if (index === -1) {
				break;
			}

			all.push({start: index, end: index + needle.length, noteFileId: h.noteFileId});
			from = index + needle.length;
		}
	}

	all.sort((a, b) => (a.start === b.start ? a.end - b.end : a.start - b.start));

	const result: HighlightSpan[] = [];
	let lastEnd = 0;
	for (const span of all) {
		if (span.start < lastEnd) {
			continue;
		}

		result.push(span);
		lastEnd = span.end;
	}

	return result;
}

export function HighlightedBody({
	content,
	highlights,
	onHighlightClick,
}: {
	content: string;
	highlights: Array<{quotedText: string; noteFileId: number}>;
	onHighlightClick: (noteFileId: number) => void;
}) {
	if (highlights.length === 0) {
		return <>{content}</>;
	}

	const spans = computeHighlightSpans(content, highlights);

	if (spans.length === 0) {
		return <>{content}</>;
	}

	const nodes: React.ReactNode[] = [];
	let cursor = 0;
	for (const [i, span] of spans.entries()) {
		if (span.start > cursor) {
			nodes.push(<Fragment key={`t-${i}`}>{content.slice(cursor, span.start)}</Fragment>);
		}

		nodes.push(<mark
			key={`m-${i}`}
			className='bg-yellow-200 dark:bg-yellow-600 cursor-pointer rounded-sm'
			onClick={() => {
				onHighlightClick(span.noteFileId);
			}}
		>
			{content.slice(span.start, span.end)}
		</mark>);
		cursor = span.end;
	}

	if (cursor < content.length) {
		nodes.push(<Fragment key='t-end'>{content.slice(cursor)}</Fragment>);
	}

	return <>{nodes}</>;
}

function ProvenanceInfo({fileId}: {fileId: number | null}) {
	const router = useRouter();
	const {data, isLoading} = useSWR<SourcesData>(
		fileId ? `/api/files/sources?id=${fileId}` : null,
		fetcher,
	);

	if (isLoading || !data) {
		return null;
	}

	const hasSources = data.sources.length > 0;
	const notes = data.derived.filter(d => d.sourceType === 'manual');
	const generated = data.derived.filter(d => d.sourceType === 'generated');

	if (!hasSources && notes.length === 0 && generated.length === 0) {
		return null;
	}

	const navigate = (id: number) => {
		router.push(`/notes/${id}`);
	};

	return (
		<div className='flex flex-col gap-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700 pb-3'>
			{hasSources && (
				<div>
					<div className='font-medium text-zinc-600 dark:text-zinc-300 mb-1'>Generated from:</div>
					<ul className='space-y-0.5 pl-2 border-l border-zinc-300 dark:border-zinc-600'>
						{data.sources.map(source => (
							<li key={source.fileId} className='truncate'>
								<button
									type='button'
									onClick={() => {
										navigate(source.fileId);
									}}
									className='text-left hover:underline'
								>
									{source.title ?? source.pathname}
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			{generated.length > 0 && (
				<div>
					<div className='font-medium text-zinc-600 dark:text-zinc-300 mb-1'>Used to generate:</div>
					<ul className='space-y-0.5 pl-2 border-l border-zinc-300 dark:border-zinc-600'>
						{generated.map(d => (
							<li key={d.fileId} className='truncate'>
								<button
									type='button'
									onClick={() => {
										navigate(d.fileId);
									}}
									className='text-left hover:underline'
								>
									{d.title ?? d.pathname}
								</button>
							</li>
						))}
					</ul>
				</div>
			)}
			{notes.length > 0 && (
				<div>
					<div className='font-medium text-zinc-600 dark:text-zinc-300 mb-1'>Notes attached:</div>
					<ul className='space-y-0.5 pl-2 border-l border-zinc-300 dark:border-zinc-600'>
						{notes.map(d => (
							<li key={d.fileId} className='truncate'>
								<button
									type='button'
									onClick={() => {
										navigate(d.fileId);
									}}
									className='text-left hover:underline'
								>
									{d.title ?? d.pathname}
								</button>
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

export function NotePage({fileId}: {fileId: number}) {
	const bodyRef = useRef<HTMLDivElement>(null);
	const [composerState, setComposerState] = useState<{quotedText?: string} | null>(null);
	const [selection, setSelection] = useState<Selection | null>(null);
	const [popoverNoteId, setPopoverNoteId] = useState<number | null>(null);
	const [isExpanderOpen, setIsExpanderOpen] = useState(false);

	const {data: noteData, isLoading: isLoadingContent} = useSWR(
		`/api/files/content?id=${fileId}`,
		fetcher,
	);
	const parsedContent = noteData ? fileContentSchema.safeParse(noteData) : null;
	const note = parsedContent?.success ? parsedContent.data : null;

	const {data: sourcesData} = useSWR<SourcesData>(
		`/api/files/sources?id=${fileId}`,
		fetcher,
	);

	const label = note?.title ?? note?.pathname;

	useEffect(() => {
		if (label) {
			pushRecentNote({fileId, title: label});
		}
	}, [fileId, label]);

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
			if (!body?.contains(range.commonAncestorContainer)) {
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

	const sourceType = note?.sourceType;
	const canExpand = sourceType === 'manual' || sourceType === 'generated';

	const highlightsInput: Array<{quotedText: string; noteFileId: number}> = [];
	if (sourcesData) {
		for (const d of sourcesData.derived) {
			if (d.sourceType !== 'manual') {
				continue;
			}

			for (const h of d.highlights) {
				if (h.quotedText && h.quotedText.length > 0) {
					highlightsInput.push({quotedText: h.quotedText, noteFileId: d.fileId});
				}
			}
		}
	}

	return (
		<div className='flex flex-row justify-center pb-20 h-full bg-white dark:bg-zinc-900'>
			<div className='flex flex-col w-full items-center overflow-y-auto'>
				<div className='flex items-center justify-between w-full md:w-[500px] px-4 md:px-0 pt-8 pb-4 border-b border-gray-800'>
					<h2 className='text-lg font-semibold text-zinc-800 dark:text-zinc-200 truncate'>
						{label ?? 'Loading...'}
					</h2>
					<div className='flex flex-row gap-2 flex-shrink-0 ml-4'>
						<button
							onClick={() => {
								setComposerState({});
							}}
							className='text-sm px-3 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors'
						>
							Note
						</button>
						{canExpand && (
							<button
								onClick={() => {
									setIsExpanderOpen(true);
								}}
								className='text-sm px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-50 transition-colors'
							>
								Expand
							</button>
						)}
					</div>
				</div>

				{isLoadingContent
					? (
						<div className='flex items-center justify-center flex-1 text-zinc-400'>
							<div className='animate-spin'>
								<LoaderIcon />
							</div>
						</div>
					)
					: (
						<div className='flex flex-col gap-4 w-full md:w-[500px] px-4 md:px-0 py-4'>
							<ProvenanceInfo fileId={fileId} />
							<div ref={bodyRef} className='text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap'>
								{note?.content !== undefined && (
									<HighlightedBody
										content={note.content}
										highlights={highlightsInput}
										onHighlightClick={setPopoverNoteId}
									/>
								)}
							</div>
							{note?.truncated && (
								<div className='text-xs text-zinc-400 dark:text-zinc-500 italic'>
									Content truncated to ~5,000 words.
								</div>
							)}
						</div>
					)}
			</div>

			{selection && (
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

			{composerState && (
				<NoteComposer
					parentFileId={fileId}
					parentLabel={label}
					quotedText={composerState.quotedText}
					onClose={() => {
						setComposerState(null);
					}}
				/>
			)}

			<NotePopover
				noteFileId={popoverNoteId}
				onClose={() => {
					setPopoverNoteId(null);
				}}
			/>

			{isExpanderOpen && canExpand && note && (
				<NoteExpander
					noteContext={{
						fileId,
						title: label ?? 'Note',
						content: note.content,
					}}
					onClose={() => {
						setIsExpanderOpen(false);
					}}
				/>
			)}
		</div>
	);
}
