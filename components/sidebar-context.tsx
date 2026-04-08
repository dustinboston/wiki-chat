"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  Dispatch,
  SetStateAction,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { mutate } from "swr";
import { Session } from "next-auth";

interface SidebarContextType {
  selectedFileIds: number[];
  setSelectedFileIds: Dispatch<SetStateAction<number[]>>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: Dispatch<SetStateAction<boolean>>;
  toggleSidebar: () => void;
  uploadQueue: string[];
  uploadFile: (name: string, content: string | File, title?: string | null) => Promise<number | null>;
  viewingFile: { pathname: string; content: string; truncated: boolean } | null;
  isLoadingFileContent: boolean;
  viewFile: (fileId: number, title: string) => Promise<void>;
  closeFileViewer: () => void;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}

export function SidebarProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [selectedFileIds, setSelectedFileIds] = useState<number[]>(() => {
    const params = searchParams.getAll("s");
    return params.map(Number).filter((n) => !isNaN(n));
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [viewingFile, setViewingFile] = useState<{
    pathname: string;
    content: string;
    truncated: boolean;
  } | null>(null);
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

  // Sync selectedFileIds to URL query params
  useEffect(() => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.delete("s");
    selectedFileIds.forEach((id) => currentParams.append("s", String(id)));

    const qs = currentParams.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    window.history.replaceState({}, "", newUrl);
  }, [selectedFileIds, pathname, searchParams]);

  const viewFile = useCallback(async (fileId: number, title: string) => {
    setIsLoadingFileContent(true);
    try {
      const res = await fetch(`/api/files/content?id=${fileId}`);
      if (res.ok) {
        const data = await res.json();
        setViewingFile({ pathname: title, content: data.content, truncated: data.truncated });
      }
    } finally {
      setIsLoadingFileContent(false);
    }
  }, []);

  const closeFileViewer = useCallback(() => {
    setViewingFile(null);
  }, []);

  const uploadFile = useCallback(
    async (name: string, content: string | File, title?: string | null): Promise<number | null> => {
      setUploadQueue((q) => [...q, name]);

      const params = new URLSearchParams({ filename: name });
      if (title) params.set("title", title);

      const response = await fetch(`/api/files/upload?${params}`, {
        method: "POST",
        body: content,
        headers:
          typeof content === "string" ? { "Content-Type": "text/plain" } : {},
      });

      setUploadQueue((q) => q.filter((f) => f !== name));

      if (response.ok) {
        const data = await response.json();
        mutate("/api/files/list");
        return data.id as number;
      }

      return null;
    },
    [],
  );

  return (
    <SidebarContext.Provider
      value={{
        selectedFileIds,
        setSelectedFileIds,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar: () => setIsSidebarOpen((prev) => !prev),
        uploadQueue,
        uploadFile,
        viewingFile,
        isLoadingFileContent,
        viewFile,
        closeFileViewer,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
