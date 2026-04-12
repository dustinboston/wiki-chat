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

const fileContentSchema = z.object({
	content: z.string(),
	truncated: z.boolean(),
});

const uploadResponseSchema = z.object({
	id: z.number(),
});

type SidebarContextType = {
	selectedFileIds: number[];
	setSelectedFileIds: Dispatch<SetStateAction<number[]>>;
	isSidebarOpen: boolean;
	setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
	toggleSidebar: () => void;
	uploadQueue: string[];
	uploadFile: (name: string, content: string | File, title?: string) => Promise<number | null>;
	viewingFile: {pathname: string; content: string; truncated: boolean} | null;
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
				setViewingFile({pathname: title, content: data.content, truncated: data.truncated});
			}
		} finally {
			setIsLoadingFileContent(false);
		}
	}, []);

	const closeFileViewer = useCallback(() => {
		setViewingFile(null);
	}, []);

	const uploadFile = useCallback(
		async (name: string, content: string | File, title?: string): Promise<number | null> => {
			setUploadQueue(queue => [...queue, name]);

			const parameters = new URLSearchParams({filename: name});
			if (title) {
				parameters.set('title', title);
			}

			const response = await fetch(`/api/files/upload?${parameters}`, {
				method: 'POST',
				body: content,
				headers:
          typeof content === 'string' ? {'Content-Type': 'text/plain'} : {},
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
