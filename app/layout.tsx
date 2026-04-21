import {type Metadata} from 'next';
import {Toaster} from 'sonner';
import './globals.css';
import {Navbar} from '@/components/navbar';
import {Sidebar} from '@/components/sidebar';
import {SidebarProvider} from '@/components/sidebar-context';
import {RecentlyViewedBar} from '@/components/recently-viewed-bar';
import {auth} from '@/app/(auth)/auth';

export const metadata: Metadata = {
	metadataBase: new URL(process.env.VERCEL_URL
		? `https://${process.env.VERCEL_URL}`
		: 'http://localhost:3000'),
	title: 'Wiki Chat',
	description:
    'Internal Knowledge Base using Retrieval Augmented Generation and Middleware',
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth();

	return (
		<html lang='en'>
			<body>
				<Toaster position='top-center' />
				<SidebarProvider session={session}>
					<div className='flex flex-col h-dvh'>
						<Navbar />
						{session && <RecentlyViewedBar />}
						<div className='flex flex-row flex-1 overflow-hidden'>
							{session && <Sidebar />}
							<main className='flex-1 overflow-auto relative'>
								{children}
							</main>
						</div>
					</div>
				</SidebarProvider>
			</body>
		</html>
	);
}
