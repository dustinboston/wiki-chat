import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/app/(auth)/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/app/db", () => ({
  getFilesByUser: vi.fn(),
  getFileById: vi.fn(),
  getChunksByFileIds: vi.fn(),
  deleteFileById: vi.fn(),
}));

import { GET as listGET } from "@/app/(chat)/api/files/list/route";
import { GET as contentGET } from "@/app/(chat)/api/files/content/route";
import { DELETE } from "@/app/(chat)/api/files/delete/route";
import { auth } from "@/app/(auth)/auth";
import {
  getFilesByUser,
  getFileById,
  getChunksByFileIds,
  deleteFileById,
} from "@/app/db";

const mockAuth = vi.mocked(auth);
const mockGetFilesByUser = vi.mocked(getFilesByUser);
const mockGetFileById = vi.mocked(getFileById);
const mockGetChunksByFileIds = vi.mocked(getChunksByFileIds);
const mockDeleteFileById = vi.mocked(deleteFileById);

describe("GET /api/files/list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);
    // Response.redirect("/login") throws in test env because it needs an absolute URL
    await expect(listGET()).rejects.toThrow();
  });

  it("redirects when user has no email", async () => {
    mockAuth.mockResolvedValue({ user: {} } as any);
    await expect(listGET()).rejects.toThrow();
  });

  it("returns mapped file list for authenticated user", async () => {
    const files = [
      { id: 1, pathname: "doc.pdf", title: "Doc", userEmail: "a@b.com", createdAt: new Date() },
      { id: 2, pathname: "notes.txt", title: null, userEmail: "a@b.com", createdAt: new Date() },
    ];
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFilesByUser.mockResolvedValue(files);

    const response = await listGET();
    const body = await response.json();

    expect(body).toEqual([
      { id: 1, pathname: "doc.pdf", title: "Doc" },
      { id: 2, pathname: "notes.txt", title: null },
    ]);
  });
});

describe("GET /api/files/content", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);
    const request = new Request("http://localhost/api/files/content?id=1");
    await expect(contentGET(request)).rejects.toThrow();
  });

  it("redirects when user has no email", async () => {
    mockAuth.mockResolvedValue({ user: {} } as any);
    const request = new Request("http://localhost/api/files/content?id=1");
    await expect(contentGET(request)).rejects.toThrow();
  });

  it("returns 400 when no id provided", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    const request = new Request("http://localhost/api/files/content");
    const response = await contentGET(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when id is not a number", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    const request = new Request("http://localhost/api/files/content?id=abc");
    const response = await contentGET(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when file not found", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue(undefined as any);
    const request = new Request("http://localhost/api/files/content?id=999");
    const response = await contentGET(request);
    expect(response.status).toBe(404);
  });

  it("returns 404 when file belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue({ id: 1, userEmail: "other@b.com" } as any);
    const request = new Request("http://localhost/api/files/content?id=1");
    const response = await contentGET(request);
    expect(response.status).toBe(404);
  });

  it("returns content from chunks", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue({ id: 1, userEmail: "a@b.com" } as any);
    mockGetChunksByFileIds.mockResolvedValue([
      { id: "1/0", fileId: 1, content: "Hello", embedding: [] },
      { id: "1/1", fileId: 1, content: "World", embedding: [] },
    ]);

    const request = new Request("http://localhost/api/files/content?id=1");
    const response = await contentGET(request);
    const body = await response.json();

    expect(body.content).toBe("Hello\n\nWorld");
    expect(body.truncated).toBe(false);
  });

  it("truncates content exceeding 5000 words", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue({ id: 1, userEmail: "a@b.com" } as any);

    // Generate content with >5000 words
    const longContent = Array.from({ length: 5500 }, (_, i) => `word${i}`).join(" ");
    mockGetChunksByFileIds.mockResolvedValue([
      { id: "1/0", fileId: 1, content: longContent, embedding: [] },
    ]);

    const request = new Request("http://localhost/api/files/content?id=1");
    const response = await contentGET(request);
    const body = await response.json();

    expect(body.truncated).toBe(true);
    expect(body.content.split(/\s+/).length).toBe(5000);
  });
});

describe("DELETE /api/files/delete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as any);
    const request = new Request("http://localhost/api/files/delete?id=1", {
      method: "DELETE",
    });
    await expect(DELETE(request)).rejects.toThrow();
  });

  it("redirects when user has no email", async () => {
    mockAuth.mockResolvedValue({ user: {} } as any);
    const request = new Request("http://localhost/api/files/delete?id=1", {
      method: "DELETE",
    });
    await expect(DELETE(request)).rejects.toThrow();
  });

  it("returns 400 when no id provided", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    const request = new Request("http://localhost/api/files/delete", {
      method: "DELETE",
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid id", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    const request = new Request("http://localhost/api/files/delete?id=abc", {
      method: "DELETE",
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });

  it("returns 404 when file not found", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue(undefined as any);
    const request = new Request("http://localhost/api/files/delete?id=99", {
      method: "DELETE",
    });
    const response = await DELETE(request);
    expect(response.status).toBe(404);
  });

  it("returns 404 when file belongs to another user", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue({ id: 1, userEmail: "other@b.com" } as any);
    const request = new Request("http://localhost/api/files/delete?id=1", {
      method: "DELETE",
    });
    const response = await DELETE(request);
    expect(response.status).toBe(404);
  });

  it("deletes file and returns empty object on success", async () => {
    mockAuth.mockResolvedValue({ user: { email: "a@b.com" } } as any);
    mockGetFileById.mockResolvedValue({ id: 1, userEmail: "a@b.com" } as any);
    mockDeleteFileById.mockResolvedValue(undefined as any);

    const request = new Request("http://localhost/api/files/delete?id=1", {
      method: "DELETE",
    });
    const response = await DELETE(request);
    const body = await response.json();

    expect(mockDeleteFileById).toHaveBeenCalledWith({ id: 1 });
    expect(body).toEqual({});
  });
});
