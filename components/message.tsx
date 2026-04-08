"use client";

import { motion } from "framer-motion";
import { BotIcon, UserIcon } from "./icons";
import { ReactNode } from "react";
import { Streamdown } from "streamdown";

interface MessageProps {
  id: number;
  role: string;
  content: string | ReactNode;
  onSaveMessage: (index: number) => void;
}

export const Message = ({ id, role, content, onSaveMessage }: MessageProps) => {
  return (
    <motion.div
      className={`flex flex-row gap-4 px-4 mb-2 pb-5 w-full md:w-[500px] md:px-0 first-of-type:pt-20 border-b border-gray-800`}
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      <div className="size-[24px] flex flex-col justify-center items-center flex-shrink-0 text-zinc-400">
        {role === "assistant" ? <BotIcon /> : <UserIcon />}
      </div>

      <div className="flex flex-col gap-6 w-full">
        <div className="text-zinc-800 dark:text-zinc-300 flex flex-col gap-4">
          <Streamdown>{content?.toString()}</Streamdown>
        </div>

        {role === "assistant" && (
          <form className="text-right">
            <button
              onClick={() => onSaveMessage(id)}
              type="button"
              className="bg-zinc-800 text-zinc-50 text-xs px-2 py-1 rounded-sm"
            >
              Add to Library
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
};
