import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth and db before importing the route
vi.mock("@/app/(auth)/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/db", () => ({
  getChatsByUser: vi.fn(),
  getChatById: vi.fn(),
  deleteChatById: vi.fn(),
}));

import { GET, DELETE } from "@/app/(chat)/api/history/route";
import { auth } from "@/app/(auth)/auth";
import { getChatsByUser, getChatById, deleteChatById } from "@/app/db";

const mockAuth = vi.mocked(auth);
const mockGetChatsByUser = vi.mocked(getChatsByUser);
const mockGetChatById = vi.mocked(getChatById);
const mockDeleteChatById = vi.mocked(deleteChatById);

describe("GET /api/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({} as any);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns chats for authenticated user", async () => {
    const chats = [{ id: "1", author: "a@b.com", messages: [] }];
    mockAuth.mockResolvedValue({
      user: { email: "a@b.com" },
    } as any);
    mockGetChatsByUser.mockResolvedValue(chats as any);

    const response = await GET();
    const body = await response.json();

    expect(mockGetChatsByUser).toHaveBeenCalledWith({ email: "a@b.com" });
    expect(body).toEqual(chats);
  });
});

describe("DELETE /api/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);
    const request = new Request("http://localhost/api/history?id=1");
    const response = await DELETE(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 when no id provided", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    const request = new Request("http://localhost/api/history");
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when chat not found", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetChatById.mockResolvedValue(undefined as any);
    const request = new Request("http://localhost/api/history?id=999");
    const response = await DELETE(request);
    expect(response.status).toBe(404);
  });

  it("returns 404 when chat belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetChatById.mockResolvedValue({ id: "1", author: "other@b.com" } as any);
    const request = new Request("http://localhost/api/history?id=1");
    const response = await DELETE(request);
    expect(response.status).toBe(404);
  });

  it("deletes chat and returns empty object on success", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetChatById.mockResolvedValue({ id: "1", author: "a@b.com" } as any);
    mockDeleteChatById.mockResolvedValue(undefined as any);

    const request = new Request("http://localhost/api/history?id=1");
    const response = await DELETE(request);
    const body = await response.json();

    expect(mockDeleteChatById).toHaveBeenCalledWith({ id: "1" });
    expect(body).toEqual({});
  });
});
