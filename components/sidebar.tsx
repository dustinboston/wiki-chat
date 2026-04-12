'use client';

import {
	useState, useRef, useEffect, useMemo,
} from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import cx from 'classnames';
import Fuse from 'fuse.js';
import {useParams, usePathname} from 'next/navigation';
import {useSidebar} from './sidebar-context';
import {
	CheckedSquare,
	ChevronRightIcon,
	InfoIcon,
	LoaderIcon,
	PencilEditIcon,
	TrashIcon,
	UncheckedSquare,
	UploadIcon,
} from './icons';
import {type AppError, fetcher} from '@/utils/functions';
import {type Chat} from '@/schema';

type FileEntry = {
	id: number;
	pathname: string;
	title: string | undefined;
	sourceType?: string;
};

function FileListItem({
	file,
	isSelected,
	isDeleting,
	onToggleSelect,
	onDelete,
	onView,
}: {
	file: FileEntry;
	isSelected: boolean;
	isDeleting: boolean;
	onToggleSelect: () => void;
	onDelete: () => void;
	onView: () => void;
}) {
	const displayName = file.title ?? file.pathname;
	const sourceLabel = file.sourceType === 'generated' ? 'GEN' : (file.sourceType === 'manual' ? 'NOTE' : undefined);

	return (
		<div
			className={cx(
				'flex flex-row p-2 border-b dark:border-zinc-700',
				isSelected && 'bg-zinc-100 dark:bg-zinc-700 dark:border-zinc-600',
			)}
		>
			<div
				className='flex flex-row items-center flex-1 min-w-0 gap-4 cursor-pointer'
				onClick={onToggleSelect}
			>
				<div
					className={cx(
						'cursor-pointer',
						isSelected && !isDeleting
							? 'text-blue-600 dark:text-zinc-50'
							: 'text-zinc-500',
					)}
				>
					{isDeleting
						? (
							<div className='animate-spin'>
								<LoaderIcon />
							</div>
						)
						: (isSelected
							? (
								<CheckedSquare />
							)
							: (
								<UncheckedSquare />
							))}
				</div>
				<div className='flex-1 text-sm text-zinc-500 dark:text-zinc-400 truncate'>
					{displayName}
				</div>
				{sourceLabel && (
					<span className='flex-shrink-0 text-[10px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-600 text-zinc-500 dark:text-zinc-400'>
						{sourceLabel}
					</span>
				)}
			</div>

			<div
				className='text-zinc-500 hover:bg-red-100 dark:text-zinc-500 hover:dark:bg-zinc-600 hover:text-red-500 p-1 px-2 cursor-pointer rounded-md'
				onClick={onDelete}
			>
				<TrashIcon />
			</div>
			<div
				className='text-zinc-500 hover:bg-zinc-200 dark:text-zinc-500 hover:dark:bg-zinc-600 p-1 px-1 cursor-pointer rounded-md'
				onClick={onView}
				title='View file contents'
			>
				<ChevronRightIcon />
			</div>
		</div>
	);
}

function FilesTabContent({
	isLoading,
	files,
	searchQuery,
	selectedFileIds,
	deleteQueue,
	uploadQueue,
	onToggleSelect,
	onDelete,
	onView,
}: {
	isLoading: boolean;
	files: FileEntry[] | undefined;
	searchQuery: string;
	selectedFileIds: number[];
	deleteQueue: number[];
	uploadQueue: string[];
	onToggleSelect: (id: number) => void;
	onDelete: (id: number) => void;
	onView: (id: number, name: string) => void;
}) {
	if (isLoading) {
		return (
			<div className='flex flex-col'>
				{[44, 32, 52].map(item => (
					<div
						key={item}
						className='flex flex-row gap-4 p-2 border-b dark:border-zinc-700 items-center'
					>
						<div className='size-4 bg-zinc-200 dark:bg-zinc-600 animate-pulse' />
						<div
							className={`w-${item} h-4 bg-zinc-200 dark:bg-zinc-600 animate-pulse`}
						/>
					</div>
				))}
			</div>
		);
	}

	if (files?.length === 0 && uploadQueue.length === 0) {
		return (
			<div className='flex flex-col gap-2 items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm'>
				<InfoIcon />
				<div>{searchQuery ? 'No matching files' : 'No files found'}</div>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full'>
			{files?.map(file => (
				<FileListItem
					key={file.id}
					file={file}
					isSelected={selectedFileIds.includes(file.id)}
					isDeleting={deleteQueue.includes(file.id)}
					onToggleSelect={() => {
						onToggleSelect(file.id);
					}}
					onDelete={() => {
						onDelete(file.id);
					}}
					onView={() => {
						onView(file.id, file.title ?? file.pathname);
					}}
				/>
			))}

			{uploadQueue.map(fileName => (
				<div key={fileName} className='flex flex-row p-2 gap-4 items-center'>
					<div className='text-zinc-500 animate-spin'>
						<LoaderIcon />
					</div>
					<div className='text-sm text-zinc-400'>{fileName}</div>
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
			className={cx(
				'flex flex-row items-center p-2 border-b dark:border-zinc-700',
				{'dark:bg-zinc-700 bg-zinc-200': isActive},
			)}
		>
			<Link
				href={`/${chat.id}`}
				className='flex-1 min-w-0 text-sm dark:text-zinc-400 dark:hover:text-zinc-200 hover:text-zinc-900 truncate'
				onClick={onNavigate}
			>
				{chat.messages[0].content}
			</Link>
			<div
				className='text-zinc-500 hover:bg-red-100 dark:text-zinc-500 hover:dark:bg-zinc-600 hover:text-red-500 p-1 px-2 cursor-pointer rounded-md flex-shrink-0'
				onClick={onDelete}
			>
				{isDeleting
					? (
						<div className='animate-spin'>
							<LoaderIcon />
						</div>
					)
					: (
						<TrashIcon />
					)}
			</div>
			<Link
				href={`/${chat.id}`}
				className='text-zinc-500 hover:bg-zinc-200 dark:text-zinc-500 hover:dark:bg-zinc-600 p-1 px-1 cursor-pointer rounded-md flex-shrink-0'
				onClick={onNavigate}
				title='Open chat'
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
			<div className='text-zinc-500 h-full flex flex-row justify-center items-center text-sm gap-2'>
				<InfoIcon />
				<div>Login to save and revisit previous chats!</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className='flex flex-col'>
				{[44, 32, 28, 52].map(item => (
					<div key={item} className='p-2 border-b dark:border-zinc-700'>
						<div
							className={`w-${item} h-[20px] bg-zinc-200 dark:bg-zinc-600 animate-pulse`}
						/>
					</div>
				))}
			</div>
		);
	}

	if (history?.length === 0) {
		return (
			<div className='text-zinc-500 h-full flex flex-row justify-center items-center text-sm gap-2'>
				<InfoIcon />
				<div>{searchQuery ? 'No matching chats' : 'No chats found'}</div>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full'>
			{history?.map(chat => (
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
	const pathname = usePathname();
	const {
		selectedFileIds,
		setSelectedFileIds,
		isSidebarOpen,
		setIsSidebarOpen,
		uploadQueue,
		uploadFile,
		viewFile,
	} = useSidebar();

	const [activeTab, setActiveTab] = useState<'files' | 'history'>('files');
	const [searchQuery, setSearchQuery] = useState('');

	const inputFileRef = useRef<HTMLInputElement>(null);
	const [deleteQueue, setDeleteQueue] = useState<number[]>([]);
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
	}, [pathname, mutateHistory]);

	const fileFuse = useMemo(
		() =>
			new Fuse(files ?? [], {keys: ['title', 'pathname'], threshold: 0.4}),
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
		? fileFuse.search(searchQuery).map(result => result.item)
		: files;

	const filteredHistory = searchQuery
		? historyFuse.search(searchQuery).map(result => result.item)
		: history;

	const handleDeleteFile = (fileId: number) => {
		void (async () => {
			setDeleteQueue(queue => [...queue, fileId]);
			await fetch(`/api/files/delete?id=${fileId}`, {method: 'DELETE'});
			setDeleteQueue(queue => queue.filter(id => id !== fileId));
			setSelectedFileIds(selected =>
				selected.filter(id => id !== fileId));
			void mutateFiles(files?.filter(entry => entry.id !== fileId));
		})();
	};

	const handleDeleteChat = (id: string) => {
		void (async () => {
			setDeleteChatQueue(queue => [...queue, id]);
			await fetch(`/api/history?id=${id}`, {method: 'DELETE'});
			setDeleteChatQueue(queue => queue.filter(qid => qid !== id));
			void mutateHistory(history?.filter(entry => entry.id !== id));
		})();
	};

	const handleToggleFileSelect = (fileId: number) => {
		setSelectedFileIds(current =>
			current.includes(fileId)
				? current.filter(id => id !== fileId)
				: [...current, fileId]);
	};

	const closeSidebar = () => {
		setIsSidebarOpen(false);
	};

	return (
		<>
			{/* Mobile overlay */}
			<div
				className={cx(
					'fixed inset-0 bg-zinc-900/50 z-40 md:hidden transition-opacity duration-300',
					isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
				)}
				onClick={closeSidebar}
			/>

			{/* Sidebar */}
			<aside
				className={cx(
					'w-80 flex-shrink-0 flex flex-col bg-white dark:bg-zinc-800 border-r dark:border-zinc-700',
					'fixed md:relative top-0 left-0 h-dvh md:h-full z-50 md:z-0',
					'transition-transform duration-300 ease-in-out',
					isSidebarOpen
						? 'translate-x-0'
						: '-translate-x-full md:translate-x-0',
				)}
			>
				{/* Top: tabs + actions */}
				<div className='p-3 flex flex-row items-center justify-between border-b dark:border-zinc-700'>
					<div className='flex flex-row gap-1'>
						<button
							onClick={() => {
								setActiveTab('files');
								setSearchQuery('');
							}}
							className={cx(
								'text-sm px-2 py-1 rounded-md transition-colors',
								activeTab === 'files'
									? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
									: 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700',
							)}
						>
							Files
						</button>
						<button
							onClick={() => {
								setActiveTab('history');
								setSearchQuery('');
							}}
							className={cx(
								'text-sm px-2 py-1 rounded-md transition-colors',
								activeTab === 'history'
									? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
									: 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700',
							)}
						>
							History
						</button>
					</div>

					<div className='flex flex-row gap-1'>
						<input
							name='file'
							ref={inputFileRef}
							type='file'
							required
							className='hidden'
							accept='application/pdf'
							multiple={false}
							onChange={event => {
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
						<div
							className='dark:text-zinc-400 dark:bg-zinc-700 hover:dark:bg-zinc-600 bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded-md cursor-pointer'
							onClick={() => inputFileRef.current?.click()}
							title='Upload a file'
						>
							<UploadIcon size={14} />
						</div>
						<Link
							href='/'
							className='dark:text-zinc-400 dark:bg-zinc-700 hover:dark:bg-zinc-600 bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded-md cursor-pointer'
							onClick={closeSidebar}
							title='New chat'
						>
							<PencilEditIcon size={14} />
						</Link>
					</div>
				</div>

				{/* Search */}
				<div className='px-3 py-2 border-b dark:border-zinc-700'>
					<input
						type='text'
						placeholder={
							activeTab === 'files' ? 'Search files...' : 'Search history...'
						}
						value={searchQuery}
						onChange={event => {
							setSearchQuery(event.target.value);
						}}
						className='w-full bg-zinc-100 dark:bg-zinc-700 rounded-md px-2 py-1 text-sm outline-none text-zinc-800 dark:text-zinc-300 placeholder:text-zinc-400'
					/>
				</div>

				{/* Content */}
				<div className='flex-1 overflow-y-auto'>
					{activeTab === 'files'
						? (
							<FilesTabContent
								isLoading={isFilesLoading}
								files={filteredFiles}
								searchQuery={searchQuery}
								selectedFileIds={selectedFileIds}
								deleteQueue={deleteQueue}
								uploadQueue={uploadQueue}
								onToggleSelect={handleToggleFileSelect}
								onDelete={handleDeleteFile}
								onView={(id, name) => {
									void viewFile(id, name);
								}}
							/>
						)
						: (
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

				{/* Bottom: selection count */}
				<div className='p-3 border-t dark:border-zinc-700'>
					<div className='text-zinc-500 dark:text-zinc-400 text-sm'>
						{selectedFileIds.length}/{files?.length ?? 0} Selected
					</div>
				</div>
			</aside>
		</>
	);
};
