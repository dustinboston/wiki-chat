'use client';

import cx from 'classnames';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRecentlyViewed } from '@/hooks/use-recently-viewed';

export function RecentlyViewedBar() {
	const parameters = useParams<{ id?: string }>();
	const currentId =
		typeof parameters.id === 'string' ? Number.parseInt(parameters.id, 10) : undefined;
	const { entries, isHydrated } = useRecentlyViewed();

	if (!isHydrated || entries.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-row items-center gap-2 overflow-hidden border-zinc-200 border-b bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
			<div className="flex min-w-0 flex-row gap-1">
				{entries.map((entry) => {
					const isActive = entry.fileId === currentId;
					return (
						<Link
							key={entry.fileId}
							href={`/notes/${entry.fileId}`}
							className={cx(
								'max-w-[200px] flex-shrink-0 truncate rounded-md px-2 py-1 text-xs transition-colors',
								isActive
									? 'bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900'
									: 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
							)}
						>
							{entry.title}
						</Link>
					);
				})}
			</div>
		</div>
	);
}
