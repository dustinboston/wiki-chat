'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSidebar } from './sidebar-context';

type NoteComposerProps = {
	parentFileId?: number;
	parentLabel?: string;
	quotedText?: string;
	onClose: () => void;
};

export function NoteComposer({
	parentFileId,
	parentLabel,
	quotedText,
	onClose,
}: NoteComposerProps) {
	const { uploadFile } = useSidebar();
	const parent = useMemo(
		() => (parentFileId === undefined ? undefined : { id: parentFileId, label: parentLabel }),
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
				className="relative flex w-full max-w-lg flex-col rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-800"
			>
				<div className="flex items-center justify-between border-zinc-200 border-b px-4 py-3 dark:border-zinc-700">
					<h2 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100">
						{parent ? `Note on ${parent.label ?? 'article'}` : 'New note'}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
					>
						Close
					</button>
				</div>

				<div className="flex flex-col gap-3 px-4 py-3">
					<input
						type="text"
						value={title}
						onChange={(event) => {
							setTitle(event.target.value);
						}}
						placeholder={defaultTitle}
						className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
					/>
					<textarea
						ref={textareaRef}
						value={body}
						onChange={(event) => {
							setBody(event.target.value);
						}}
						placeholder="Write your note…"
						rows={10}
						className="w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 font-mono text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
					/>
					{errorMessage && <div className="text-red-500 text-xs">{errorMessage}</div>}
				</div>

				<div className="flex justify-end gap-2 border-zinc-200 border-t px-4 py-3 dark:border-zinc-700">
					<button
						type="button"
						onClick={onClose}
						className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							void handleSave();
						}}
						disabled={!canSave}
						className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-zinc-50 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-zinc-800"
					>
						{status === 'saving' ? 'Saving…' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	);
}
