import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/db", () => ({
  getChunksByFileIds: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: Object.assign(vi.fn().mockReturnValue("mock-chat-model"), {
    embedding: vi.fn().mockReturnValue("mock-embedding-model"),
  }),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  embed: vi.fn(),
  cosineSimilarity: vi.fn(),
}));

import { ragMiddleware } from "@/ai/rag-middleware";
import { getChunksByFileIds } from "@/app/db";
import { generateObject, generateText, embed, cosineSimilarity } from "ai";

const mockGetChunks = vi.mocked(getChunksByFileIds);
const mockGenerateObject = vi.mocked(generateObject);
const mockGenerateText = vi.mocked(generateText);
const mockEmbed = vi.mocked(embed);
const mockCosineSimilarity = vi.mocked(cosineSimilarity);

const transformParams = ragMiddleware.transformParams!;

function makeUserMessage(text: string) {
  return {
    role: "user" as const,
    content: [{ type: "text" as const, text }],
  };
}

function makeParams(
  messages: any[],
  fileIds: number[] | undefined = undefined,
) {
  return {
    params: {
      prompt: [...messages],
      providerMetadata: fileIds
        ? { files: { selection: fileIds } }
        : undefined,
    },
  } as any;
}

describe("ragMiddleware.transformParams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns params unchanged when no provider metadata", async () => {
    const msg = makeUserMessage("hello");
    const input = makeParams([msg]);
    const result = await transformParams(input);
    expect(result).toBe(input.params);
  });

  it("returns params unchanged when selection is empty", async () => {
    const msg = makeUserMessage("hello");
    const input = makeParams([msg], []);
    const result = await transformParams(input);
    expect(result).toBe(input.params);
  });

  it("returns params unchanged when last message is not user role", async () => {
    const msg = { role: "assistant", content: [{ type: "text", text: "hi" }] };
    const input = makeParams([msg], [1]);
    const result = await transformParams(input);
    // The assistant message should be pushed back
    expect(result.prompt).toHaveLength(1);
    expect(result.prompt[0].role).toBe("assistant");
  });

  it("returns params unchanged when messages array is empty", async () => {
    const input = makeParams([], [1]);
    const result = await transformParams(input);
    // recentMessage is undefined, so params returned as-is
    expect(result.prompt).toHaveLength(0);
  });

  it("returns params unchanged when classification is not a question", async () => {
    const msg = makeUserMessage("The sky is blue.");
    const input = makeParams([msg], [1]);

    mockGenerateObject.mockResolvedValue({ object: "statement" } as any);

    const result = await transformParams(input);
    // Message should be pushed back without RAG
    expect(result.prompt).toHaveLength(1);
    expect(result.prompt[0].content).toEqual(msg.content);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("performs RAG pipeline for questions", async () => {
    const msg = makeUserMessage("What is quantum computing?");
    const input = makeParams([msg], [1, 2]);

    mockGenerateObject.mockResolvedValue({ object: "question" } as any);
    mockGenerateText.mockResolvedValue({
      text: "Quantum computing uses qubits...",
    } as any);
    mockEmbed.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
    } as any);
    mockGetChunks.mockResolvedValue([
      { id: "1/0", fileId: 1, content: "Chunk A", embedding: [0.1, 0.2, 0.3] },
      { id: "1/1", fileId: 1, content: "Chunk B", embedding: [0.4, 0.5, 0.6] },
      { id: "2/0", fileId: 2, content: "Chunk C", embedding: [0.7, 0.8, 0.9] },
    ]);

    // Return different similarity scores to test ranking
    mockCosineSimilarity
      .mockReturnValueOnce(0.9)  // Chunk A
      .mockReturnValueOnce(0.5)  // Chunk B
      .mockReturnValueOnce(0.7); // Chunk C

    const result = await transformParams(input);

    // Should have called classify, generate hypothesis, embed
    expect(mockGenerateObject).toHaveBeenCalledOnce();
    expect(mockGenerateText).toHaveBeenCalledOnce();
    expect(mockEmbed).toHaveBeenCalledOnce();
    expect(mockGetChunks).toHaveBeenCalledWith({ fileIds: [1, 2] });

    // The resulting prompt should have the user message with appended chunks
    const lastMessage = result.prompt[result.prompt.length - 1];
    expect(lastMessage.role).toBe("user");

    // Original text + "relevant info" text + 3 chunk texts = 5 content parts
    expect(lastMessage.content).toHaveLength(5);

    // Chunks should be sorted by similarity (A=0.9, C=0.7, B=0.5)
    const chunkTexts = lastMessage.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text);

    expect(chunkTexts).toContain("Chunk A");
    expect(chunkTexts).toContain("Chunk B");
    expect(chunkTexts).toContain("Chunk C");

    // Verify ordering: Chunk A (0.9) before Chunk C (0.7) before Chunk B (0.5)
    const aIdx = chunkTexts.indexOf("Chunk A");
    const cIdx = chunkTexts.indexOf("Chunk C");
    const bIdx = chunkTexts.indexOf("Chunk B");
    expect(aIdx).toBeLessThan(cIdx);
    expect(cIdx).toBeLessThan(bIdx);
  });

  it("limits to top 10 chunks", async () => {
    const msg = makeUserMessage("What is AI?");
    const fileIds = [1];
    const input = makeParams([msg], fileIds);

    mockGenerateObject.mockResolvedValue({ object: "question" } as any);
    mockGenerateText.mockResolvedValue({ text: "AI is..." } as any);
    mockEmbed.mockResolvedValue({ embedding: [0.1] } as any);

    // Create 15 chunks
    const chunks = Array.from({ length: 15 }, (_, i) => ({
      id: `1/${i}`,
      fileId: 1,
      content: `Chunk ${i}`,
      embedding: [i * 0.1],
    }));
    mockGetChunks.mockResolvedValue(chunks);

    // Give decreasing similarity so we can verify top-10
    chunks.forEach((_, i) => {
      mockCosineSimilarity.mockReturnValueOnce(1 - i * 0.05);
    });

    const result = await transformParams(input);
    const lastMessage = result.prompt[result.prompt.length - 1];

    // Original text (1) + "relevant info" text (1) + 10 chunks = 12
    expect(lastMessage.content).toHaveLength(12);
  });
});
