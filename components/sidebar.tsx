/* eslint-disable @typescript-eslint/strict-void-return */
'use client';

import cx from 'classnames';
import Fuse from 'fuse.js';
import { FilePlusCorner, LogOut, MessageCirclePlus } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { logout } from '@/app/(auth)/actions';
import type { Chat } from '@/schema';
import { type AppError, fetcher } from '@/utils/functions';
import {
	CheckedSquare,
	ChevronRightIcon,
	InfoIcon,
	LoaderIcon,
	TrashIcon,
	UncheckedSquare,
	UploadIcon,
} from './icons';
import { NoteComposer } from './note-composer';
import { useSidebar } from './sidebar-context';

type FileEntry = {
	id: number;
	pathname: string;
	title: string | undefined;
	sourceType?: string;
};

function FileListItem({
	file,
	isSelected,
	onToggleSelect,
}: {
	file: FileEntry;
	isSelected: boolean;
	onToggleSelect: () => void;
}) {
	const displayName = file.title ?? file.pathname;
	const sourceLabel =
		file.sourceType === 'generated' ? 'GEN' : file.sourceType === 'manual' ? 'NOTE' : undefined;

	return (
		<div
			className={cx(
				'flex flex-row items-center gap-3 border-b p-2 dark:border-zinc-700',
				isSelected && 'bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700',
			)}
		>
			<button
				type="button"
				onClick={onToggleSelect}
				aria-label={isSelected ? 'Deselect file' : 'Select file'}
				className={cx(
					'flex-shrink-0 cursor-pointer',
					isSelected ? 'text-blue-600 dark:text-zinc-50' : 'text-zinc-500',
				)}
			>
				{isSelected ? <CheckedSquare /> : <UncheckedSquare />}
			</button>
			<Link
				href={`/notes/${file.id}`}
				className="min-w-0 flex-1 truncate text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
			>
				{displayName}
			</Link>
			{sourceLabel && (
				<span className="flex-shrink-0 rounded bg-zinc-200 px-1 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-600 dark:text-zinc-400">
					{sourceLabel}
				</span>
			)}
		</div>
	);
}

function FilesTabContent({
	isLoading,
	files,
	searchQuery,
	selectedFileIds,
	uploadQueue,
	onToggleSelect,
}: {
	isLoading: boolean;
	files: FileEntry[] | undefined;
	searchQuery: string;
	selectedFileIds: number[];
	uploadQueue: string[];
	onToggleSelect: (id: number) => void;
}) {
	if (isLoading) {
		return (
			<div className="flex flex-col">
				{[44, 32, 52].map((item) => (
					<div
						key={item}
						className="flex flex-row items-center gap-4 border-b p-2 dark:border-zinc-700"
					>
						<div className="size-4 animate-pulse bg-zinc-200 dark:bg-zinc-600" />
						<div className={`w-${item} h-4 animate-pulse bg-zinc-200 dark:bg-zinc-600`} />
					</div>
				))}
			</div>
		);
	}

	if (files?.length === 0 && uploadQueue.length === 0) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
				<InfoIcon />
				<div>{searchQuery ? 'No matching files' : 'No files found'}</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{files?.map((file) => (
				<FileListItem
					key={file.id}
					file={file}
					isSelected={selectedFileIds.includes(file.id)}
					onToggleSelect={() => {
						onToggleSelect(file.id);
					}}
				/>
			))}

			{uploadQueue.map((fileName) => (
				<div key={fileName} className="flex flex-row items-center gap-4 p-2">
					<div className="animate-spin text-zinc-500">
						<LoaderIcon />
					</div>
					<div className="text-sm text-zinc-400">{fileName}</div>
				</div>
			))}
		</div>
	);
}

function HistoryListItem({
	chat,
	isActive,
	isDeleting,
	onDelete,
	onNavigate,
}: {
	chat: Chat;
	isActive: boolean;
	isDeleting: boolean;
	onDelete: () => void;
	onNavigate: () => void;
}) {
	return (
		<div
			className={cx('flex flex-row items-center border-b p-2 dark:border-zinc-700', {
				'bg-zinc-200 dark:bg-zinc-700': isActive,
			})}
		>
			<Link
				href={`/${chat.id}`}
				className="min-w-0 flex-1 truncate text-sm hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
				onClick={onNavigate}
			>
				{chat.messages[0].content}
			</Link>
			<button
				type="button"
				aria-label="Delete chat"
				className="flex-shrink-0 cursor-pointer rounded-md p-1 px-2 text-zinc-500 hover:bg-red-100 hover:text-red-500 dark:text-zinc-500 hover:dark:bg-zinc-600"
				onClick={onDelete}
			>
				{isDeleting ? (
					<div className="animate-spin">
						<LoaderIcon />
					</div>
				) : (
					<TrashIcon />
				)}
			</button>
			<Link
				href={`/${chat.id}`}
				className="flex-shrink-0 cursor-pointer rounded-md p-1 px-1 text-zinc-500 hover:bg-zinc-200 dark:text-zinc-500 hover:dark:bg-zinc-600"
				onClick={onNavigate}
				title="Open chat"
			>
				<ChevronRightIcon />
			</Link>
		</div>
	);
}

function HistoryTabContent({
	isLoading,
	history,
	historyError,
	searchQuery,
	chatId,
	deleteChatQueue,
	onDelete,
	onNavigate,
}: {
	isLoading: boolean;
	history: Chat[] | undefined;
	historyError: AppError | undefined;
	searchQuery: string;
	chatId: string | undefined;
	deleteChatQueue: string[];
	onDelete: (id: string) => void;
	onNavigate: () => void;
}) {
	if (historyError?.status === 401) {
		return (
			<div className="flex h-full flex-row items-center justify-center gap-2 text-sm text-zinc-500">
				<InfoIcon />
				<div>Login to save and revisit previous chats!</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col">
				{[44, 32, 28, 52].map((item) => (
					<div key={item} className="border-b p-2 dark:border-zinc-700">
						<div className={`w-${item} h-[20px] animate-pulse bg-zinc-200 dark:bg-zinc-600`} />
					</div>
				))}
			</div>
		);
	}

	if (history?.length === 0) {
		return (
			<div className="flex h-full flex-row items-center justify-center gap-2 text-sm text-zinc-500">
				<InfoIcon />
				<div>{searchQuery ? 'No matching chats' : 'No chats found'}</div>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{history?.map((chat) => (
				<HistoryListItem
					key={chat.id}
					chat={chat}
					isActive={chatId === chat.id}
					isDeleting={deleteChatQueue.includes(chat.id)}
					onDelete={() => {
						onDelete(chat.id);
					}}
					onNavigate={onNavigate}
				/>
			))}
		</div>
	);
}

export const Sidebar = () => {
	const parameters = useParams();
	const rawId = parameters.id;
	const chatId = typeof rawId === 'string' ? rawId : undefined;
	const _pathname = usePathname();
	const {
		selectedFileIds,
		setSelectedFileIds,
		isSidebarOpen,
		setIsSidebarOpen,
		uploadQueue,
		uploadFile,
	} = useSidebar();

	const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
	const [searchQuery, setSearchQuery] = useState('');
	const [isNoteComposerOpen, setIsNoteComposerOpen] = useState(false);

	const inputFileRef = useRef<HTMLInputElement>(null);
	const [deleteChatQueue, setDeleteChatQueue] = useState<string[]>([]);

	const {
		data: files,
		mutate: mutateFiles,
		isLoading: isFilesLoading,
	} = useSWR<FileEntry[]>('/api/files/list', fetcher, {
		fallbackData: [],
	});

	const {
		data: history,
		error: historyError,
		isLoading: isHistoryLoading,
		mutate: mutateHistory,
	} = useSWR<Chat[], AppError>('/api/history', fetcher, {
		fallbackData: [],
	});

	useEffect(() => {
		void mutateHistory();
	}, [mutateHistory]);

	const fileFuse = useMemo(
		() => new Fuse(files ?? [], { keys: ['title', 'pathname'], threshold: 0.4 }),
		[files],
	);

	const historyFuse = useMemo(
		() =>
			new Fuse(history ?? [], {
				keys: [
					{
						name: 'messages.0.content',
						getFn: (chat: Chat) => chat.messages[0]?.content ?? '',
					},
				],
				threshold: 0.4,
			}),
		[history],
	);

	const filteredFiles = searchQuery
		? fileFuse.search(searchQuery).map((result) => result.item)
		: files;

	const filteredHistory = searchQuery
		? historyFuse.search(searchQuery).map((result) => result.item)
		: history;

	const handleDeleteChat = (id: string) => {
		// eslint-disable-next-line no-alert
		if (!globalThis.confirm('Delete this chat? This action can be undone by an administrator.')) {
			return;
		}

		void (async () => {
			setDeleteChatQueue((queue) => [...queue, id]);
			await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
			setDeleteChatQueue((queue) => queue.filter((qid) => qid !== id));
			void mutateHistory(history?.filter((entry) => entry.id !== id));
		})();
	};

	const handleToggleFileSelect = (fileId: number) => {
		setSelectedFileIds((current) =>
			current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId],
		);
	};

	const closeSidebar = () => {
		setIsSidebarOpen(false);
	};

	return (
		<>
			{/* Mobile overlay */}
			<button
				type="button"
				aria-label="Close sidebar"
				tabIndex={isSidebarOpen ? 0 : -1}
				className={cx(
					'fixed inset-0 z-40 bg-zinc-900/50 transition-opacity duration-300 md:hidden',
					isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
				)}
				onClick={closeSidebar}
			/>

			{/* Sidebar */}
			<aside
				className={cx(
					'flex w-80 flex-shrink-0 flex-col border-r bg-white dark:border-zinc-700 dark:bg-zinc-800',
					'fixed top-0 left-0 z-50 h-dvh md:relative md:z-0 md:h-full',
					'transition-transform duration-300 ease-in-out',
					isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
				)}
			>
				{/* Title */}
				<div className="border-b px-3 py-3 dark:border-zinc-700">
					<div className="font-semibold text-base text-zinc-900 dark:text-zinc-100">Wiki Chat</div>
				</div>

				{/* Top: tabs + actions */}
				<div className="flex flex-row items-center justify-between border-b p-3 dark:border-zinc-700">
					<div className="flex flex-row gap-1">
						<button
							type="button"
							onClick={() => {
								setActiveTab('files');
								setSearchQuery('');
							}}
							className={cx(
								'rounded-md px-2 py-1 text-sm transition-colors',
								activeTab === 'files'
									? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
									: 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700',
							)}
						>
							Files
						</button>
						<button
							type="button"
							onClick={() => {
								setActiveTab('history');
								setSearchQuery('');
							}}
							className={cx(
								'rounded-md px-2 py-1 text-sm transition-colors',
								activeTab === 'history'
									? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100'
									: 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-700',
							)}
						>
							History
						</button>
					</div>

					<div className="flex flex-row gap-1">
						<input
							name="file"
							ref={inputFileRef}
							type="file"
							required
							className="hidden"
							accept="application/pdf"
							multiple={false}
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) {
									void (async () => {
										const newId = await uploadFile(file.name, file);
										if (newId !== null) {
											void mutateFiles();
										}
									})();
								}
							}}
						/>
						<button
							type="button"
							aria-label="Upload a file"
							title="Upload a file"
							className="cursor-pointer rounded-md bg-zinc-100 p-1.5 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 hover:dark:bg-zinc-600"
							onClick={() => inputFileRef.current?.click()}
						>
							<UploadIcon size={14} />
						</button>
						<button
							type="button"
							onClick={() => {
								setIsNoteComposerOpen(true);
							}}
							className="cursor-pointer rounded-md bg-zinc-100 p-1.5 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 hover:dark:bg-zinc-600"
							title="New note"
							aria-label="New note"
						>
							<FilePlusCorner size={14} />
						</button>
						<Link
							href="/"
							className="cursor-pointer rounded-md bg-zinc-100 p-1.5 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 hover:dark:bg-zinc-600"
							onClick={closeSidebar}
							title="New chat"
							aria-label="New chat"
						>
							<MessageCirclePlus size={14} />
						</Link>
					</div>
				</div>

				{/* Search */}
				<div className="border-b px-3 py-2 dark:border-zinc-700">
					<input
						type="text"
						placeholder={activeTab === 'files' ? 'Search files...' : 'Search history...'}
						value={searchQuery}
						onChange={(event) => {
							setSearchQuery(event.target.value);
						}}
						className="w-full rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:bg-zinc-700 dark:text-zinc-300"
					/>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto">
					{activeTab === 'files' ? (
						<FilesTabContent
							isLoading={isFilesLoading}
							files={filteredFiles}
							searchQuery={searchQuery}
							selectedFileIds={selectedFileIds}
							uploadQueue={uploadQueue}
							onToggleSelect={handleToggleFileSelect}
						/>
					) : (
						<HistoryTabContent
							isLoading={isHistoryLoading && !historyError}
							history={filteredHistory}
							historyError={historyError}
							searchQuery={searchQuery}
							chatId={chatId}
							deleteChatQueue={deleteChatQueue}
							onDelete={handleDeleteChat}
							onNavigate={closeSidebar}
						/>
					)}
				</div>

				{/* Bottom: selection count + logout */}
				<div className="flex flex-row items-center justify-between border-t p-3 dark:border-zinc-700">
					<div className="text-sm text-zinc-500 dark:text-zinc-400">
						{selectedFileIds.length}/{files?.length ?? 0} Selected
					</div>
					<form action={logout}>
						<button
							type="submit"
							aria-label="Sign out"
							title="Sign out"
							className="cursor-pointer rounded-md bg-zinc-100 p-1.5 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 hover:dark:bg-zinc-600"
						>
							<LogOut size={14} />
						</button>
					</form>
				</div>
			</aside>

			{isNoteComposerOpen && (
				<NoteComposer
					onClose={() => {
						setIsNoteComposerOpen(false);
					}}
				/>
			)}
		</>
	);
};
