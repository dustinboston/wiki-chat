import { openai } from "@ai-sdk/openai";
import { experimental_wrapLanguageModel as wrapLanguageModel } from "ai";
import { ragMiddleware } from "./rag-middleware";

export const customModel = wrapLanguageModel({
  model: openai("gpt-5.4-2026-03-05"), // gpt-4o
  middleware: ragMiddleware,
});
