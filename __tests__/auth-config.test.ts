import { describe, it, expect } from "vitest";
import { authConfig } from "@/app/(auth)/auth.config";

const authorized = authConfig.callbacks.authorized as (args: {
  auth: { user?: {} } | null;
  request: { nextUrl: URL };
}) => boolean | Response;

function callAuthorized(pathname: string, loggedIn: boolean) {
  const nextUrl = new URL(`http://localhost${pathname}`);
  const auth = loggedIn ? { user: { email: "test@test.com" } } : null;
  return authorized({ auth, request: { nextUrl } });
}

describe("auth.config authorized callback", () => {
  describe("logged-in user", () => {
    it("redirects away from /login to /", () => {
      const result = callAuthorized("/login", true);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("location")).toBe(
        "http://localhost/",
      );
    });

    it("redirects away from /register to /", () => {
      const result = callAuthorized("/register", true);
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).headers.get("location")).toBe(
        "http://localhost/",
      );
    });

    it("allows access to chat pages", () => {
      expect(callAuthorized("/", true)).toBe(true);
    });

    it("allows access to chat with id", () => {
      expect(callAuthorized("/abc-123", true)).toBe(true);
    });
  });

  describe("unauthenticated user", () => {
    it("allows access to /login", () => {
      expect(callAuthorized("/login", false)).toBe(true);
    });

    it("allows access to /register", () => {
      expect(callAuthorized("/register", false)).toBe(true);
    });

    it("denies access to / (chat root)", () => {
      expect(callAuthorized("/", false)).toBe(false);
    });

    it("denies access to /some-chat-id", () => {
      expect(callAuthorized("/some-chat-id", false)).toBe(false);
    });
  });
});

// Note: The auth.config.ts lines 32-36 handle a fallback case for paths that
// don't start with "/" — which in practice never happens since all paths start
// with "/". This branch is effectively dead code and not worth forcing coverage for.
