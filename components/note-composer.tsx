'use client';

import {
	useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {useSidebar} from './sidebar-context';

type NoteComposerProps = {
	parentFileId?: number;
	parentLabel?: string;
	quotedText?: string;
	onClose: () => void;
};

export function NoteComposer({parentFileId, parentLabel, quotedText, onClose}: NoteComposerProps) {
	const {uploadFile} = useSidebar();
	const parent = useMemo(
		() => (parentFileId === undefined ? undefined : {id: parentFileId, label: parentLabel}),
		[parentFileId, parentLabel],
	);
	const quoted = useMemo(() => quotedText, [quotedText]);

	const initialBody = quoted ? `> ${quoted}\n\n` : '';
	const [title, setTitle] = useState('');
	const [body, setBody] = useState(initialBody);
	const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.focus();
			const position = initialBody.length;
			textarea.setSelectionRange(position, position);
		}
	}, [initialBody]);

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

	const defaultTitle = parent?.label ? `Note on ${parent.label}` : 'Note';
	const canSave = body.trim().length > 0 && status !== 'saving';

	const handleSave = useCallback(async () => {
		if (!canSave) {
			return;
		}

		setStatus('saving');
		setErrorMessage(null);
		const resolvedTitle = title.trim().length > 0 ? title.trim() : defaultTitle;
		const filename = `note-${Date.now()}.md`;
		const newId = await uploadFile(filename, body, {
			title: resolvedTitle,
			sourceType: 'manual',
			parentFileId: parent?.id,
			quotedText: quoted,
		});

		if (newId === null) {
			setStatus('error');
			setErrorMessage('Failed to save note. Please try again.');
			return;
		}

		onClose();
	}, [canSave, title, defaultTitle, body, uploadFile, parent, quoted, onClose]);

	return (
		<div
			className='fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/50 px-4'
			onClick={onClose}
		>
			<div
				className='w-full max-w-lg rounded-lg bg-white dark:bg-zinc-800 shadow-xl border border-zinc-200 dark:border-zinc-700 flex flex-col'
				onClick={event => {
					event.stopPropagation();
				}}
			>
				<div className='flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700'>
					<h2 className='text-sm font-semibold text-zinc-800 dark:text-zinc-100'>
						{parent ? `Note on ${parent.label ?? 'article'}` : 'New note'}
					</h2>
					<button
						type='button'
						onClick={onClose}
						className='text-xs px-2 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors'
					>
						Close
					</button>
				</div>

				<div className='flex flex-col gap-3 px-4 py-3'>
					<input
						type='text'
						value={title}
						onChange={event => {
							setTitle(event.target.value);
						}}
						placeholder={defaultTitle}
						className={
							'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 '
							+ 'rounded-md px-2 py-1 text-sm outline-none text-zinc-800 dark:text-zinc-200 '
							+ 'placeholder:text-zinc-400'
						}
					/>
					<textarea
						ref={textareaRef}
						value={body}
						onChange={event => {
							setBody(event.target.value);
						}}
						placeholder='Write your note…'
						rows={10}
						className={
							'w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 '
							+ 'rounded-md px-2 py-2 text-sm outline-none text-zinc-800 dark:text-zinc-200 '
							+ 'placeholder:text-zinc-400 resize-none font-mono'
						}
					/>
					{errorMessage && (
						<div className='text-xs text-red-500'>{errorMessage}</div>
					)}
				</div>

				<div className='flex justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700'>
					<button
						type='button'
						onClick={onClose}
						className='text-xs px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors'
					>
						Cancel
					</button>
					<button
						type='button'
						onClick={() => {
							void handleSave();
						}}
						disabled={!canSave}
						className={
							'text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-50 '
							+ 'transition-colors disabled:opacity-60 disabled:cursor-not-allowed '
							+ 'disabled:hover:bg-zinc-800'
						}
					>
						{status === 'saving' ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	);
}
