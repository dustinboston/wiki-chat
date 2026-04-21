import { SidebarToggle } from './sidebar-toggle';

export const Navbar = () => (
	<div className="z-30 flex w-full flex-row items-center border-b bg-white px-3 py-2 md:hidden dark:border-zinc-800 dark:bg-zinc-900">
		<SidebarToggle />
	</div>
);
