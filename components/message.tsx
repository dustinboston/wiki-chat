'use client';

import {useState} from 'react';
import {motion} from 'framer-motion';
import {Streamdown} from 'streamdown';
import {BotIcon, UserIcon} from './icons';

export type AggregatedSource = {
	fileId: number;
	name: string;
	similarity: number;
};

type MessageProps = {
	id: number;
	role: string;
	content: string;
	sources?: AggregatedSource[];
	onSaveMessage: (index: number) => void;
};

function SourcesList({sources}: {sources: AggregatedSource[]}) {
	const [isExpanded, setIsExpanded] = useState(false);

	if (sources.length === 0) {
		return null;
	}

	return (
		<div className='text-xs text-zinc-500 dark:text-zinc-400'>
			<button
				type='button'
				onClick={() => {
					setIsExpanded(!isExpanded);
				}}
				className='hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors'
			>
				Sources ({sources.length} {sources.length === 1 ? 'file' : 'files'})
				{' '}
				{isExpanded ? '▾' : '▸'}
			</button>
			{isExpanded && (
				<ul className='mt-1 space-y-0.5 pl-2 border-l border-zinc-200 dark:border-zinc-700'>
					{sources.map(source => (
						<li key={source.fileId} className='truncate'>
							{source.name}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

export const Message = ({id, role, content, sources = [], onSaveMessage}: MessageProps) => (
	<motion.div
		className={'flex flex-row gap-4 px-4 mb-2 pb-5 w-full md:w-[500px] md:px-0 first-of-type:pt-20 border-b border-gray-800'}
		initial={{y: 5, opacity: 0}}
		animate={{y: 0, opacity: 1}}
	>
		<div className='size-[24px] flex flex-col justify-center items-center flex-shrink-0 text-zinc-400'>
			{role === 'assistant' ? <BotIcon /> : <UserIcon />}
		</div>

		<div className='flex flex-col gap-6 w-full'>
			<div className='text-zinc-800 dark:text-zinc-300 flex flex-col gap-4'>
				<Streamdown>{content}</Streamdown>
			</div>

			{role === 'assistant' && (
				<div className='flex flex-col gap-2'>
					<SourcesList sources={sources} />
					<form className='text-right'>
						<button
							onClick={() => {
								onSaveMessage(id);
							}}
							type='button'
							className='bg-zinc-800 text-zinc-50 text-xs px-2 py-1 rounded-sm'
						>
							Add to Library
						</button>
					</form>
				</div>
			)}
		</div>
	</motion.div>
);
