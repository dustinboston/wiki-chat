'use client';

import useSWR from 'swr';
import {useSidebar} from './sidebar-context';
import {LoaderIcon} from './icons';
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

export function FileViewer() {
	const {viewingFile, isLoadingFileContent, closeFileViewer} = useSidebar();

	if (!viewingFile && !isLoadingFileContent) {
		return null;
	}

	return (
		<div className='absolute inset-0 z-10 flex flex-row justify-center pb-20 h-full bg-white dark:bg-zinc-900'>
			<div className='flex flex-col w-full items-center overflow-y-auto'>
				<div className='flex items-center justify-between w-full md:w-[500px] px-4 md:px-0 pt-20 pb-4 border-b border-gray-800'>
					<h2 className='text-lg font-semibold text-zinc-800 dark:text-zinc-200 truncate'>
						{viewingFile?.pathname ?? 'Loading...'}
					</h2>
					<button
						onClick={closeFileViewer}
						className='text-sm px-3 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-600 dark:text-zinc-300 transition-colors flex-shrink-0 ml-4' // eslint-disable-line @stylistic/max-len
					>
						Close
					</button>
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
							<div className='text-zinc-800 dark:text-zinc-300 whitespace-pre-wrap'>
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
		</div>
	);
}
