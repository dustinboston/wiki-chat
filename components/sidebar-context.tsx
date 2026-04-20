'use client';

import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	type ReactNode,
	type Dispatch,
	type SetStateAction,
} from 'react';
import {useSearchParams, useRouter, usePathname} from 'next/navigation';
import {mutate} from 'swr';
import {type Session} from 'next-auth';
import {z} from 'zod';
import type {SourceChunk} from '@/ai/rag';

const fileContentSchema = z.object({
	content: z.string(),
	truncated: z.boolean(),
});

const uploadResponseSchema = z.object({
	id: z.number(),
});

export type UploadOptions = {
	title?: string;
	sourceType?: 'upload' | 'generated' | 'manual';
	sourceChunks?: SourceChunk[];
	parentFileId?: number;
	quotedText?: string;
};

type SidebarContextType = {
	selectedFileIds: number[];
	setSelectedFileIds: Dispatch<SetStateAction<number[]>>;
	isSidebarOpen: boolean;
	setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
	toggleSidebar: () => void;
	uploadQueue: string[];
	uploadFile: (name: string, content: string | File, options?: UploadOptions) => Promise<number | null>;
	viewingFile: {fileId: number; pathname: string; content: string; truncated: boolean} | null;
	isLoadingFileContent: boolean;
	viewFile: (fileId: number, title: string) => Promise<void>;
	closeFileViewer: () => void;
};

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error('useSidebar must be used within SidebarProvider');
	}

	return context;
}

export function SidebarProvider({
	children,
	session,
}: {
	children: ReactNode;
	session: Session | null;
}) {
	const searchParameters = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();

	const [selectedFileIds, setSelectedFileIds] = useState<number[]>(() => {
		const parameters = searchParameters.getAll('s');
		return parameters.map(Number).filter(value => !Number.isNaN(value));
	});
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);
	const [uploadQueue, setUploadQueue] = useState<string[]>([]);
	const [viewingFile, setViewingFile] = useState<{
		fileId: number;
		pathname: string;
		content: string;
		truncated: boolean;
	} | null>(null);
	const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

	// Sync selectedFileIds to URL query params
	useEffect(() => {
		const currentParameters = new URLSearchParams(searchParameters.toString());
		currentParameters.delete('s');
		for (const id of selectedFileIds) {
			currentParameters.append('s', String(id));
		}

		const qs = currentParameters.toString();
		const newUrl = qs ? `${pathname}?${qs}` : pathname;
		globalThis.history.replaceState({}, '', newUrl);
	}, [selectedFileIds, pathname, searchParameters]);

	const viewFile = useCallback(async (fileId: number, title: string) => {
		setIsLoadingFileContent(true);
		try {
			const response = await fetch(`/api/files/content?id=${fileId}`);
			if (response.ok) {
				const json: unknown = await response.json();
				const data = fileContentSchema.parse(json);
				setViewingFile({
					fileId, pathname: title, content: data.content, truncated: data.truncated,
				});
			}
		} finally {
			setIsLoadingFileContent(false);
		}
	}, []);

	const closeFileViewer = useCallback(() => {
		setViewingFile(null);
	}, []);

	const uploadFile = useCallback(
		async (name: string, content: string | File, options?: UploadOptions): Promise<number | null> => {
			setUploadQueue(queue => [...queue, name]);

			const parameters = new URLSearchParams({filename: name});
			if (options?.title) {
				parameters.set('title', options.title);
			}

			if (options?.sourceType) {
				parameters.set('sourceType', options.sourceType);
			}

			let body: string | File | Blob;
			let headers: Record<string, string> = {};

			const hasSourceChunks = Boolean(options?.sourceChunks && options.sourceChunks.length > 0);
			const hasParent = options?.parentFileId !== undefined;

			if (content instanceof File) {
				body = content;
			} else if (hasSourceChunks || hasParent) {
				const payload: Record<string, unknown> = {content};
				if (hasSourceChunks) {
					payload.sourceChunks = options!.sourceChunks;
				}

				if (hasParent) {
					payload.parentFileId = options!.parentFileId;
					if (options!.quotedText !== undefined) {
						payload.quotedText = options!.quotedText;
					}
				}

				body = JSON.stringify(payload);
				headers = {'Content-Type': 'application/json'};
			} else {
				body = content;
				headers = {'Content-Type': 'text/plain'};
			}

			const response = await fetch(`/api/files/upload?${parameters}`, {
				method: 'POST',
				body,
				headers,
			});

			setUploadQueue(queue => queue.filter(item => item !== name));

			if (response.ok) {
				const json: unknown = await response.json();
				const data = uploadResponseSchema.parse(json);
				void mutate('/api/files/list');
				return data.id;
			}

			return null;
		},
		[],
	);

	return (
		<SidebarContext.Provider
			value={{
				selectedFileIds,
				setSelectedFileIds,
				isSidebarOpen,
				setIsSidebarOpen,
				toggleSidebar() {
					setIsSidebarOpen(previous => !previous);
				},
				uploadQueue,
				uploadFile,
				viewingFile,
				isLoadingFileContent,
				viewFile,
				closeFileViewer,
			}}
		>
			{children}
		</SidebarContext.Provider>
	);
}
