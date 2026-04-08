"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import cx from "classnames";
import Fuse from "fuse.js";
import { useParams, usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";
import { fetcher } from "@/utils/functions";
import { Chat } from "@/schema";
import {
  CheckedSquare,
  ChevronRightIcon,
  InfoIcon,
  LoaderIcon,
  PencilEditIcon,
  TrashIcon,
  UncheckedSquare,
  UploadIcon,
} from "./icons";

interface FileEntry {
  id: number;
  pathname: string;
  title: string | null;
}

export const Sidebar = () => {
  const params = useParams();
  const chatId = params.id as string | undefined;
  const pathname = usePathname();
  const {
    selectedFileIds,
    setSelectedFileIds,
    isSidebarOpen,
    setIsSidebarOpen,
    uploadQueue,
    uploadFile,
    viewFile,
  } = useSidebar();

  const [activeTab, setActiveTab] = useState<"files" | "history">("files");
  const [searchQuery, setSearchQuery] = useState("");

  const inputFileRef = useRef<HTMLInputElement>(null);
  const [deleteQueue, setDeleteQueue] = useState<number[]>([]);
  const [deleteChatQueue, setDeleteChatQueue] = useState<string[]>([]);

  const {
    data: files,
    mutate: mutateFiles,
    isLoading: isFilesLoading,
  } = useSWR<Array<FileEntry>>("/api/files/list", fetcher, {
    fallbackData: [],
  });

  const {
    data: history,
    error: historyError,
    isLoading: isHistoryLoading,
    mutate: mutateHistory,
  } = useSWR<Array<Chat>>("/api/history", fetcher, {
    fallbackData: [],
  });

  useEffect(() => {
    mutateHistory();
  }, [pathname, mutateHistory]);

  const fileFuse = useMemo(
    () => new Fuse(files ?? [], { keys: ["title", "pathname"], threshold: 0.4 }),
    [files],
  );

  const historyFuse = useMemo(
    () =>
      new Fuse(history ?? [], {
        keys: [{ name: "messages.0.content", getFn: (chat: Chat) => chat.messages[0]?.content as string ?? "" }],
        threshold: 0.4,
      }),
    [history],
  );

  const filteredFiles = searchQuery
    ? fileFuse.search(searchQuery).map((r) => r.item)
    : files;

  const filteredHistory = searchQuery
    ? historyFuse.search(searchQuery).map((r) => r.item)
    : history;

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cx(
          "fixed inset-0 bg-zinc-900/50 z-40 md:hidden transition-opacity duration-300",
          isSidebarOpen
            ? "opacity-100"
            : "opacity-0 pointer-events-none",
        )}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={cx(
          "w-80 flex-shrink-0 flex flex-col bg-white dark:bg-zinc-800 border-r dark:border-zinc-700",
          "fixed md:relative top-0 left-0 h-dvh md:h-full z-50 md:z-0",
          "transition-transform duration-300 ease-in-out",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        {/* Top: tabs + actions */}
        <div className="p-3 flex flex-row items-center justify-between border-b dark:border-zinc-700">
          <div className="flex flex-row gap-1">
            <button
              onClick={() => { setActiveTab("files"); setSearchQuery(""); }}
              className={cx(
                "text-sm px-2 py-1 rounded-md transition-colors",
                activeTab === "files"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700",
              )}
            >
              Files
            </button>
            <button
              onClick={() => { setActiveTab("history"); setSearchQuery(""); }}
              className={cx(
                "text-sm px-2 py-1 rounded-md transition-colors",
                activeTab === "history"
                  ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700",
              )}
            >
              History
            </button>
          </div>

          <div className="flex flex-row gap-1">
            <input
              name="file"
              ref={inputFileRef}
              type="file"
              required
              className="hidden"
              accept="application/pdf"
              multiple={false}
              onChange={async (event) => {
                const file = event.target.files![0];
                if (file) {
                  const newId = await uploadFile(file.name, file);
                  if (newId !== null) {
                    mutateFiles();
                  }
                }
              }}
            />
            <div
              className="dark:text-zinc-400 dark:bg-zinc-700 hover:dark:bg-zinc-600 bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded-md cursor-pointer"
              onClick={() => inputFileRef.current?.click()}
              title="Upload a file"
            >
              <UploadIcon size={14} />
            </div>
            <Link
              href="/"
              className="dark:text-zinc-400 dark:bg-zinc-700 hover:dark:bg-zinc-600 bg-zinc-100 hover:bg-zinc-200 p-1.5 rounded-md cursor-pointer"
              onClick={() => setIsSidebarOpen(false)}
              title="New chat"
            >
              <PencilEditIcon size={14} />
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b dark:border-zinc-700">
          <input
            type="text"
            placeholder={activeTab === "files" ? "Search files..." : "Search history..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-100 dark:bg-zinc-700 rounded-md px-2 py-1 text-sm outline-none text-zinc-800 dark:text-zinc-300 placeholder:text-zinc-400"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "files" ? (
            <div className="flex flex-col h-full">
              {isFilesLoading ? (
                <div className="flex flex-col">
                  {[44, 32, 52].map((item) => (
                    <div
                      key={item}
                      className="flex flex-row gap-4 p-2 border-b dark:border-zinc-700 items-center"
                    >
                      <div className="size-4 bg-zinc-200 dark:bg-zinc-600 animate-pulse" />
                      <div
                        className={`w-${item} h-4 bg-zinc-200 dark:bg-zinc-600 animate-pulse`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {!isFilesLoading &&
              filteredFiles?.length === 0 &&
              uploadQueue.length === 0 ? (
                <div className="flex flex-col gap-2 items-center justify-center h-full text-zinc-500 dark:text-zinc-400 text-sm">
                  <InfoIcon />
                  <div>{searchQuery ? "No matching files" : "No files found"}</div>
                </div>
              ) : null}

              {filteredFiles?.map((file) => (
                <div
                  key={file.id}
                  className={cx(
                    "flex flex-row p-2 border-b dark:border-zinc-700",
                    selectedFileIds.includes(file.id) &&
                      "bg-zinc-100 dark:bg-zinc-700 dark:border-zinc-600",
                  )}
                >
                  <div
                    className="flex flex-row items-center flex-1 min-w-0 gap-4 cursor-pointer"
                    onClick={() => {
                      setSelectedFileIds((current) =>
                        current.includes(file.id)
                          ? current.filter((id) => id !== file.id)
                          : [...current, file.id],
                      );
                    }}
                  >
                    <div
                      className={cx(
                        "cursor-pointer",
                        selectedFileIds.includes(file.id) &&
                          !deleteQueue.includes(file.id)
                          ? "text-blue-600 dark:text-zinc-50"
                          : "text-zinc-500",
                      )}
                    >
                      {deleteQueue.includes(file.id) ? (
                        <div className="animate-spin">
                          <LoaderIcon />
                        </div>
                      ) : selectedFileIds.includes(file.id) ? (
                        <CheckedSquare />
                      ) : (
                        <UncheckedSquare />
                      )}
                    </div>
                    <div className="flex-1 text-sm text-zinc-500 dark:text-zinc-400 truncate">
                      {file.title || file.pathname}
                    </div>
                  </div>

                  <div
                    className="text-zinc-500 hover:bg-red-100 dark:text-zinc-500 hover:dark:bg-zinc-600 hover:text-red-500 p-1 px-2 cursor-pointer rounded-md"
                    onClick={async () => {
                      setDeleteQueue((q) => [...q, file.id]);
                      await fetch(
                        `/api/files/delete?id=${file.id}`,
                        { method: "DELETE" },
                      );
                      setDeleteQueue((q) =>
                        q.filter((id) => id !== file.id),
                      );
                      setSelectedFileIds((s) =>
                        s.filter((id) => id !== file.id),
                      );
                      mutateFiles(
                        files?.filter(
                          (f) => f.id !== file.id,
                        ),
                      );
                    }}
                  >
                    <TrashIcon />
                  </div>
                  <div
                    className="text-zinc-500 hover:bg-zinc-200 dark:text-zinc-500 hover:dark:bg-zinc-600 p-1 px-1 cursor-pointer rounded-md"
                    onClick={() => viewFile(file.id, file.title || file.pathname)}
                    title="View file contents"
                  >
                    <ChevronRightIcon />
                  </div>
                </div>
              ))}

              {uploadQueue.map((fileName) => (
                <div
                  key={fileName}
                  className="flex flex-row p-2 gap-4 items-center"
                >
                  <div className="text-zinc-500 animate-spin">
                    <LoaderIcon />
                  </div>
                  <div className="text-sm text-zinc-400">{fileName}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {historyError?.status === 401 ? (
                <div className="text-zinc-500 h-full flex flex-row justify-center items-center text-sm gap-2">
                  <InfoIcon />
                  <div>Login to save and revisit previous chats!</div>
                </div>
              ) : null}

              {!isHistoryLoading &&
              filteredHistory?.length === 0 &&
              !historyError ? (
                <div className="text-zinc-500 h-full flex flex-row justify-center items-center text-sm gap-2">
                  <InfoIcon />
                  <div>{searchQuery ? "No matching chats" : "No chats found"}</div>
                </div>
              ) : null}

              {isHistoryLoading && !historyError ? (
                <div className="flex flex-col">
                  {[44, 32, 28, 52].map((item) => (
                    <div
                      key={item}
                      className="p-2 border-b dark:border-zinc-700"
                    >
                      <div
                        className={`w-${item} h-[20px] bg-zinc-200 dark:bg-zinc-600 animate-pulse`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {filteredHistory?.map((chat) => (
                <div
                  key={chat.id}
                  className={cx(
                    "flex flex-row items-center p-2 border-b dark:border-zinc-700",
                    {
                      "dark:bg-zinc-700 bg-zinc-200":
                        chatId === chat.id,
                    },
                  )}
                >
                  <Link
                    href={`/${chat.id}`}
                    className="flex-1 min-w-0 text-sm dark:text-zinc-400 dark:hover:text-zinc-200 hover:text-zinc-900 truncate"
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    {chat.messages[0].content as string}
                  </Link>
                  <div
                    className="text-zinc-500 hover:bg-red-100 dark:text-zinc-500 hover:dark:bg-zinc-600 hover:text-red-500 p-1 px-2 cursor-pointer rounded-md flex-shrink-0"
                    onClick={async () => {
                      setDeleteChatQueue((q) => [...q, chat.id]);
                      await fetch(
                        `/api/history?id=${chat.id}`,
                        { method: "DELETE" },
                      );
                      setDeleteChatQueue((q) =>
                        q.filter((id) => id !== chat.id),
                      );
                      mutateHistory(
                        history?.filter((c) => c.id !== chat.id),
                      );
                    }}
                  >
                    {deleteChatQueue.includes(chat.id) ? (
                      <div className="animate-spin">
                        <LoaderIcon />
                      </div>
                    ) : (
                      <TrashIcon />
                    )}
                  </div>
                  <Link
                    href={`/${chat.id}`}
                    className="text-zinc-500 hover:bg-zinc-200 dark:text-zinc-500 hover:dark:bg-zinc-600 p-1 px-1 cursor-pointer rounded-md flex-shrink-0"
                    onClick={() => setIsSidebarOpen(false)}
                    title="Open chat"
                  >
                    <ChevronRightIcon />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: selection count */}
        <div className="p-3 border-t dark:border-zinc-700">
          <div className="text-zinc-500 dark:text-zinc-400 text-sm">
            {selectedFileIds.length}/{files?.length ?? 0} Selected
          </div>
        </div>
      </aside>
    </>
  );
};
