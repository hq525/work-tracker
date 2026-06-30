import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    listQuestions: vi.fn(),
    createEntry: vi.fn(),
    replaceMatchesForEntry: vi.fn(),
  },
}));
vi.mock("@/lib/claude", () => ({ matchEntry: vi.fn() }));

import { db } from "@/lib/db";
import { matchEntry } from "@/lib/claude";
import { POST } from "@/app/api/entries/route";

afterEach(() => vi.clearAllMocks());

test("POST creates an entry, runs matching, and reports matched count", async () => {
  (db.listQuestions as any).mockResolvedValue([{ id: 9, text: "deadline?", companyTags: [], createdAt: "" }]);
  (db.createEntry as any).mockResolvedValue({ id: 1, body: "shipped", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (matchEntry as any).mockResolvedValue([{ questionId: 9, strength: "strong", reason: "x" }]);
  (db.replaceMatchesForEntry as any).mockResolvedValue(undefined);

  const req = new Request("http://t/api/entries", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "shipped", tags: [] }),
  });
  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.matchedCount).toBe(1);
  expect(db.replaceMatchesForEntry).toHaveBeenCalledWith(1, [{ questionId: 9, strength: "strong", reason: "x" }]);
});

test("POST rejects an empty body", async () => {
  const req = new Request("http://t/api/entries", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "  " }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("POST still returns the entry if matching fails", async () => {
  (db.listQuestions as any).mockResolvedValue([{ id: 9, text: "q", companyTags: [], createdAt: "" }]);
  (db.createEntry as any).mockResolvedValue({ id: 2, body: "x", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (matchEntry as any).mockRejectedValue(new Error("claude down"));

  const req = new Request("http://t/api/entries", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "x" }),
  });
  const res = await POST(req);
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.entry.id).toBe(2);
  expect(json.matchedCount).toBe(null);
});
