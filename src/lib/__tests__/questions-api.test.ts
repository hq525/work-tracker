import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { listEntries: vi.fn(), createQuestion: vi.fn(), replaceMatchesForQuestion: vi.fn() },
}));
vi.mock("@/lib/claude", () => ({ matchQuestion: vi.fn() }));

import { db } from "@/lib/db";
import { matchQuestion } from "@/lib/claude";
import { POST } from "@/app/api/questions/route";

afterEach(() => vi.clearAllMocks());

test("POST creates a question, runs matching, reports count", async () => {
  (db.listEntries as any).mockResolvedValue([{ id: 10, body: "x", occurredOn: "", createdAt: "", tags: [] }]);
  (db.createQuestion as any).mockResolvedValue({ id: 1, text: "deadline?", companyTags: ["stripe"], createdAt: "" });
  (matchQuestion as any).mockResolvedValue([{ entryId: 10, strength: "weak", reason: "r" }]);

  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ text: "deadline?", companyTags: ["stripe"] }) });
  const res = await POST(req);
  const json = await res.json();
  expect(json.matchedCount).toBe(1);
  expect(db.replaceMatchesForQuestion).toHaveBeenCalledWith(1, [{ entryId: 10, strength: "weak", reason: "r" }]);
});

test("POST rejects empty text", async () => {
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ text: " " }) });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
