'use client';

import { MenuIcon } from './icons';
import { useSidebar } from './sidebar-context';

export const SidebarToggle = () => {
	const { toggleSidebar } = useSidebar();
	return (
		<button
			type="button"
			aria-label="Toggle sidebar"
			className="cursor-pointer text-zinc-500 md:hidden dark:text-zinc-400"
			onClick={toggleSidebar}
		>
			<MenuIcon />
		</button>
	);
};
