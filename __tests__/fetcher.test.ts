import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetcher } from "@/utils/functions";

describe("fetcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on successful response", async () => {
    const data = { items: [1, 2, 3] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(data),
      }),
    );

    const result = await fetcher("https://example.com/api");

    expect(fetch).toHaveBeenCalledWith("https://example.com/api");
    expect(result).toEqual(data);
  });

  it("throws an error with status and info on non-ok response", async () => {
    const errorBody = { message: "Not found" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve(errorBody),
      }),
    );

    try {
      await fetcher("https://example.com/missing");
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(
        "An error occurred while fetching the data.",
      );
      expect(error.status).toBe(404);
      expect(error.info).toEqual(errorBody);
    }
  });
});
