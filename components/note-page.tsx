'use client';

import {
	Fragment, useEffect, useRef, useState,
} from 'react';
import {useRouter} from 'next/navigation';
import useSWR, {mutate} from 'swr';
import {Bot, FilePlusCorner} from 'lucide-react';
import {fileContentSchema} from './sidebar-context';
import {LoaderIcon, PencilEditIcon, TrashIcon} from './icons';
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

type HighlightInput = {quotedText: string; noteFileId: number};

function getHighlightsInput(sourcesData: SourcesData | undefined): HighlightInput[] {
	const result: HighlightInput[] = [];
	if (!sourcesData) {
		return result;
	}

	for (const d of sourcesData.derived) {
		if (d.sourceType !== 'manual') {
			continue;
		}

		for (const h of d.highlights) {
			if (h.quotedText && h.quotedText.length > 0) {
				result.push({quotedText: h.quotedText, noteFileId: d.fileId});
			}
		}
	}

	return result;
}

type NoteHeaderActionsProps = {
	isEditing: boolean;
	isSaving: boolean;
	isDeleting: boolean;
	canExpand: boolean;
	canEdit: boolean;
	onNewNote: () => void;
	onExpand: () => void;
	onStartEdit: () => void;
	onCancelEdit: () => void;
	onSaveEdit: () => void;
	onDelete: () => void;
};

function EditingActions({isSaving, onCancelEdit, onSaveEdit}: Pick<NoteHeaderActionsProps, 'isSaving' | 'onCancelEdit' | 'onSaveEdit'>) {
	return (
		<>
			<button
				type='button'
				onClick={onCancelEdit}
				disabled={isSaving}
				className={
					'text-sm px-3 py-1 rounded-md transition-colors '
					+ 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 '
					+ 'dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-200 '
					+ 'disabled:opacity-60 disabled:cursor-not-allowed'
				}
			>
				Cancel
			</button>
			<button
				type='button'
				onClick={onSaveEdit}
				disabled={isSaving}
				className={
					'text-sm px-3 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-50 '
					+ 'transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
				}
			>
				{isSaving ? 'Saving…' : 'Save'}
			</button>
		</>
	);
}

const iconButtonClass = 'p-1.5 rounded-md cursor-pointer transition-colors '
	+ 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 '
	+ 'dark:hover:text-zinc-200 dark:hover:bg-zinc-700';

function ViewingActions({
	isDeleting, canExpand, canEdit, onNewNote, onExpand, onStartEdit, onDelete,
}: Omit<NoteHeaderActionsProps, 'isEditing' | 'isSaving' | 'onCancelEdit' | 'onSaveEdit'>) {
	return (
		<>
			<button
				type='button'
				onClick={onNewNote}
				title='New note'
				aria-label='New note'
				className={iconButtonClass}
			>
				<FilePlusCorner size={16} />
			</button>
			{canExpand && (
				<button
					type='button'
					onClick={onExpand}
					title='Expand with AI'
					aria-label='Expand with AI'
					className={iconButtonClass}
				>
					<Bot size={16} />
				</button>
			)}
			{canEdit && (
				<button
					type='button'
					onClick={onStartEdit}
					title='Edit this note'
					aria-label='Edit this note'
					className={iconButtonClass}
				>
					<PencilEditIcon />
				</button>
			)}
			<button
				type='button'
				onClick={onDelete}
				disabled={isDeleting}
				title='Delete this file'
				aria-label='Delete this file'
				className={
					'p-1.5 rounded-md cursor-pointer transition-colors '
					+ 'text-zinc-500 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 '
					+ 'disabled:opacity-60 disabled:cursor-not-allowed'
				}
			>
				{isDeleting
					? (
						<div className='animate-spin'>
							<LoaderIcon />
						</div>
					)
					: <TrashIcon />}
			</button>
		</>
	);
}

function NoteHeaderActions(props: NoteHeaderActionsProps) {
	return props.isEditing
		? <EditingActions isSaving={props.isSaving} onCancelEdit={props.onCancelEdit} onSaveEdit={props.onSaveEdit} />
		: (
			<ViewingActions
				isDeleting={props.isDeleting}
				canExpand={props.canExpand}
				canEdit={props.canEdit}
				onNewNote={props.onNewNote}
				onExpand={props.onExpand}
				onStartEdit={props.onStartEdit}
				onDelete={props.onDelete}
			/>
		);
}

type NoteContent = {
	content: string;
	truncated: boolean;
};

function NoteEditView({
	editedContent, setEditedContent, isSaving, saveError,
}: {
	editedContent: string;
	setEditedContent: (value: string) => void;
	isSaving: boolean;
	saveError: string | null;
}) {
	return (
		<>
			<textarea
				value={editedContent}
				onChange={event => {
					setEditedContent(event.target.value);
				}}
				disabled={isSaving}
				className={
					'w-full min-h-[60vh] p-3 text-sm font-mono rounded-md resize-y '
					+ 'text-zinc-800 bg-zinc-50 border border-zinc-200 '
					+ 'dark:text-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 '
					+ 'focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:opacity-60'
				}
			/>
			{saveError && (
				<div className='text-xs text-red-500'>{saveError}</div>
			)}
			<div className='text-xs text-zinc-400 dark:text-zinc-500 italic'>
				Markdown is preserved as-is.
			</div>
		</>
	);
}

function NoteReadView({
	bodyRef, note, highlightsInput, onHighlightClick,
}: {
	bodyRef: React.RefObject<HTMLDivElement>;
	note: NoteContent | null;
	highlightsInput: HighlightInput[];
	onHighlightClick: (noteFileId: number) => void;
}) {
	return (
		<>
			<div ref={bodyRef} className='text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap'>
				{note?.content !== undefined && (
					<HighlightedBody
						content={note.content}
						highlights={highlightsInput}
						onHighlightClick={onHighlightClick}
					/>
				)}
			</div>
			{note?.truncated && (
				<div className='text-xs text-zinc-400 dark:text-zinc-500 italic'>
					Content truncated to ~5,000 words.
				</div>
			)}
		</>
	);
}

export function NotePage({fileId}: {fileId: number}) {
	const router = useRouter();
	const bodyRef = useRef<HTMLDivElement>(null);
	const [composerState, setComposerState] = useState<{quotedText?: string} | null>(null);
	const [selection, setSelection] = useState<Selection | null>(null);
	const [popoverNoteId, setPopoverNoteId] = useState<number | null>(null);
	const [isExpanderOpen, setIsExpanderOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editedContent, setEditedContent] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	const handleDelete = async () => {
		// eslint-disable-next-line no-alert
		if (!globalThis.confirm('Delete this file? This action can be undone by an administrator.')) {
			return;
		}

		setIsDeleting(true);
		const response = await fetch(`/api/files/delete?id=${fileId}`, {method: 'DELETE'});
		if (response.ok) {
			await mutate('/api/files/list');
			router.push('/');
			return;
		}

		setIsDeleting(false);
	};

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
		if (composerState ?? isEditing) {
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
	}, [composerState, isEditing]);

	const sourceType = note?.sourceType;
	const canExpand = sourceType === 'manual' || sourceType === 'generated';
	const canEdit = canExpand && note?.truncated === false;

	const handleStartEdit = () => {
		if (!note) {
			return;
		}

		setEditedContent(note.content);
		setSaveError(null);
		setIsEditing(true);
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setSaveError(null);
	};

	const handleSaveEdit = async () => {
		if (!note || editedContent.trim().length === 0) {
			setSaveError('Content cannot be empty.');
			return;
		}

		setIsSaving(true);
		setSaveError(null);
		const response = await fetch(`/api/files/content?id=${fileId}`, {
			method: 'PATCH',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({content: editedContent}),
		});
		setIsSaving(false);
		if (!response.ok) {
			setSaveError('Failed to save. Try again.');
			return;
		}

		await mutate(`/api/files/content?id=${fileId}`);
		setIsEditing(false);
	};

	const highlightsInput = getHighlightsInput(sourcesData);

	return (
		<div className='flex flex-row justify-center pb-20 h-full bg-white dark:bg-zinc-900'>
			<div className='flex flex-col w-full items-center overflow-y-auto'>
				<div className='flex items-center justify-between w-full md:w-[500px] px-4 md:px-0 pt-8 pb-4 border-b border-gray-800'>
					<h2 className='text-lg font-semibold text-zinc-800 dark:text-zinc-200 truncate'>
						{label ?? 'Loading...'}
					</h2>
					<div className='flex flex-row gap-2 flex-shrink-0 ml-4 items-center'>
						<NoteHeaderActions
							isEditing={isEditing}
							isSaving={isSaving}
							isDeleting={isDeleting}
							canExpand={canExpand}
							canEdit={canEdit}
							onNewNote={() => {
								setComposerState({});
							}}
							onExpand={() => {
								setIsExpanderOpen(true);
							}}
							onStartEdit={handleStartEdit}
							onCancelEdit={handleCancelEdit}
							onSaveEdit={() => {
								void handleSaveEdit();
							}}
							onDelete={() => {
								void handleDelete();
							}}
						/>
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
							{isEditing
								? (
									<NoteEditView
										editedContent={editedContent}
										setEditedContent={setEditedContent}
										isSaving={isSaving}
										saveError={saveError}
									/>
								)
								: (
									<NoteReadView
										bodyRef={bodyRef}
										note={note}
										highlightsInput={highlightsInput}
										onHighlightClick={setPopoverNoteId}
									/>
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
