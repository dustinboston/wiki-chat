import {SidebarToggle} from './sidebar-toggle';

export const Navbar = () => (
	<div className='md:hidden bg-white w-full border-b dark:border-zinc-800 py-2 px-3 flex flex-row items-center dark:bg-zinc-900 z-30'>
		<SidebarToggle />
	</div>
);
