import { Navbar } from "@/components/navbar";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/sidebar-context";
import { FileViewer } from "@/components/file-viewer";
import { auth } from "@/app/(auth)/auth";
import { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://ai-sdk-preview-internal-knowledge-base.vercel.app",
  ),
  title: "Internal Knowledge Base",
  description:
    "Internal Knowledge Base using Retrieval Augmented Generation and Middleware",
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
        <SidebarProvider session={session}>
          <div className="flex flex-col h-dvh">
            <Navbar />
            <div className="flex flex-row flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-auto relative">
                {children}
                <FileViewer />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
