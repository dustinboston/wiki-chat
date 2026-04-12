'use client';

import {useSidebar} from './sidebar-context';
import {MenuIcon} from './icons';

export const SidebarToggle = () => {
	const {toggleSidebar} = useSidebar();
	return (
		<div
			className='md:hidden dark:text-zinc-400 text-zinc-500 cursor-pointer'
			onClick={toggleSidebar}
		>
			<MenuIcon />
		</div>
	);
};
