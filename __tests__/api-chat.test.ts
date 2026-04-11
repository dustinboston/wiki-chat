import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/(auth)/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/db", () => ({
  createMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/ai", () => ({
  customModel: "mocked-model",
}));

vi.mock("ai", () => ({
  streamText: vi.fn(),
}));

import { POST } from "@/app/(chat)/api/chat/route";
import { auth } from "@/app/(auth)/auth";
import { createMessage } from "@/app/db";
import { streamText } from "ai";

const mockAuth = vi.mocked(auth);
const mockStreamText = vi.mocked(streamText);
const mockCreateMessage = vi.mocked(createMessage);

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);

    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1", messages: [], selectedFileIds: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("calls streamText with correct parameters when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "a@b.com" },
    } as any);

    const mockResponse = new Response("streamed data");
    mockStreamText.mockReturnValue({
      toDataStreamResponse: vi.fn().mockReturnValue(mockResponse),
    } as any);

    const messages = [{ role: "user", content: "hello" }];
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "chat-1",
        messages,
        selectedFileIds: [1, 2],
      }),
    });

    const response = await POST(request);

    expect(mockStreamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "mocked-model",
        temperature: 0,
        messages,
        experimental_providerMetadata: {
          files: { selection: [1, 2] },
        },
      }),
    );
    expect(response).toBe(mockResponse);
  });

  it("onFinish callback saves the message to the database", async () => {
    mockAuth.mockResolvedValue({
      user: { email: "a@b.com" },
    } as any);

    let capturedOnFinish: ((args: { text: string }) => Promise<void>) | undefined;
    mockStreamText.mockImplementation((opts: any) => {
      capturedOnFinish = opts.onFinish;
      return {
        toDataStreamResponse: vi.fn().mockReturnValue(new Response("ok")),
      } as any;
    });

    const messages = [{ role: "user", content: "hello" }];
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "chat-1", messages, selectedFileIds: [] }),
    });

    await POST(request);

    // Invoke the captured onFinish callback
    expect(capturedOnFinish).toBeDefined();
    await capturedOnFinish!({ text: "AI response" });

    expect(mockCreateMessage).toHaveBeenCalledWith({
      id: "chat-1",
      messages: [...messages, { role: "assistant", content: "AI response" }],
      author: "a@b.com",
    });
  });
});
