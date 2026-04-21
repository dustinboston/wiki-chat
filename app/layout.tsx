import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { auth } from '@/app/(auth)/auth';
import { Navbar } from '@/components/navbar';
import { RecentlyViewedBar } from '@/components/recently-viewed-bar';
import { Sidebar } from '@/components/sidebar';
import { SidebarProvider } from '@/components/sidebar-context';

export const metadata: Metadata = {
	metadataBase: new URL(
		process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
	),
	title: 'Wiki Chat',
	description: 'Internal Knowledge Base using Retrieval Augmented Generation and Middleware',
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await auth();

	return (
		<html lang="en">
			<body>
				<Toaster position="top-center" />
				<SidebarProvider>
					<div className="flex h-dvh flex-col">
						<Navbar />
						<div className="flex flex-1 flex-row overflow-hidden">
							{session && <Sidebar />}
							<div className="flex flex-1 flex-col overflow-hidden">
								{session && <RecentlyViewedBar />}
								<main className="relative flex-1 overflow-auto">{children}</main>
							</div>
						</div>
					</div>
				</SidebarProvider>
			</body>
		</html>
	);
}
