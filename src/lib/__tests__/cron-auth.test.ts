/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { authorizeCron } from "../cron-auth";

function req(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/cron/test", {
    method: "POST",
    headers,
  });
}

const ORIGINAL_ENV = process.env.NODE_ENV;

// process.env.NODE_ENV is typed as a readonly literal; cast to mutate it.
function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

describe("authorizeCron", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    setNodeEnv(ORIGINAL_ENV);
  });

  describe("when CRON_SECRET is configured", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "super-secret-token";
    });

    it("authorizes a request with the correct Bearer token", () => {
      expect(
        authorizeCron(req({ authorization: "Bearer super-secret-token" }))
      ).toBe(true);
    });

    it("rejects a request with a wrong token of the same length", () => {
      expect(
        authorizeCron(req({ authorization: "Bearer wrong-secret-token!" }))
      ).toBe(false);
    });

    it("rejects a request with a token of a different length", () => {
      expect(authorizeCron(req({ authorization: "Bearer short" }))).toBe(false);
    });

    it("rejects a request with no Authorization header", () => {
      expect(authorizeCron(req())).toBe(false);
    });

    it("rejects a raw token without the Bearer prefix", () => {
      expect(authorizeCron(req({ authorization: "super-secret-token" }))).toBe(
        false
      );
    });
  });

  describe("when CRON_SECRET is missing", () => {
    beforeEach(() => {
      delete process.env.CRON_SECRET;
    });

    it("fails closed in production (rejects)", () => {
      setNodeEnv("production");
      expect(authorizeCron(req())).toBe(false);
    });

    it("allows in development/test so local runs work", () => {
      setNodeEnv("test");
      expect(authorizeCron(req())).toBe(true);
    });
  });
});
