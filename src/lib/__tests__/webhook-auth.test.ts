/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { authorizeWebhook } from "../webhook-auth";

function req(token?: string): NextRequest {
  const url = `http://localhost/api/whatsapp/webhook${token !== undefined ? `?token=${token}` : ""}`;
  return new NextRequest(url, { method: "POST" });
}

const ORIGINAL_ENV = process.env.NODE_ENV;

// process.env.NODE_ENV is typed as a readonly literal; cast to mutate it.
function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("authorizeWebhook", () => {
  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    setNodeEnv(ORIGINAL_ENV);
  });

  describe("when WEBHOOK_SECRET is configured", () => {
    beforeEach(() => {
      process.env.WEBHOOK_SECRET = "super-secret-token";
    });

    it("authorizes a request with the correct token", () => {
      expect(authorizeWebhook(req("super-secret-token"))).toBe(true);
    });

    it("rejects a wrong token of the same length", () => {
      expect(authorizeWebhook(req("wrong-secret-token!"))).toBe(false);
    });

    it("rejects a token of a different length", () => {
      expect(authorizeWebhook(req("short"))).toBe(false);
    });

    it("rejects a request with no token param", () => {
      expect(authorizeWebhook(req())).toBe(false);
    });
  });

  describe("when WEBHOOK_SECRET is missing", () => {
    it("fails closed in production (rejects)", () => {
      setNodeEnv("production");
      expect(authorizeWebhook(req())).toBe(false);
    });

    it("allows in development/test so local runs work", () => {
      setNodeEnv("test");
      expect(authorizeWebhook(req())).toBe(true);
    });
  });
});
