'use client';

import Link from 'next/link';
import {useParams, useRouter} from 'next/navigation';
import {useRecentlyViewed} from '@/hooks/use-recently-viewed';

export function RecentlyViewedBar() {
	const router = useRouter();
	const parameters = useParams<{id?: string}>();
	const currentId = typeof parameters.id === 'string' ? Number.parseInt(parameters.id, 10) : undefined;
	const {entries, isHydrated} = useRecentlyViewed();

	if (!isHydrated || entries.length === 0) {
		return null;
	}

	return (
		<div className='flex flex-row items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 overflow-x-auto'>
			<div className='flex flex-row gap-1 flex-shrink-0'>
				<button
					type='button'
					aria-label='Back'
					onClick={() => {
						router.back();
					}}
					className='text-xs px-2 py-1 rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors'
				>
					←
				</button>
				<button
					type='button'
					aria-label='Forward'
					onClick={() => {
						router.forward();
					}}
					className='text-xs px-2 py-1 rounded-md bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors'
				>
					→
				</button>
			</div>

			<div className='flex flex-row gap-1 min-w-0'>
				{entries.map(entry => {
					const isActive = entry.fileId === currentId;
					return (
						<Link
							key={entry.fileId}
							href={`/notes/${entry.fileId}`}
							className={
								'text-xs px-2 py-1 rounded-md transition-colors flex-shrink-0 max-w-[200px] truncate '
								+ (isActive
									? 'bg-zinc-800 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900'
									: 'bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
								)
							}
						>
							{entry.title}
						</Link>
					);
				})}
			</div>
		</div>
	);
}
