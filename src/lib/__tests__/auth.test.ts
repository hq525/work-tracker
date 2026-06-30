import { beforeAll, expect, test } from "vitest";
import { verifyPassword, createSessionToken, verifySessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.APP_PASSWORD = "secret123";
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-32";
});

test("verifyPassword accepts correct and rejects wrong", () => {
  expect(verifyPassword("secret123")).toBe(true);
  expect(verifyPassword("nope")).toBe(false);
});

test("session token round-trips", async () => {
  const token = await createSessionToken();
  expect(await verifySessionToken(token)).toBe(true);
});

test("invalid/missing token rejected", async () => {
  expect(await verifySessionToken(undefined)).toBe(false);
  expect(await verifySessionToken("garbage")).toBe(false);
});
