import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    listQuestions: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn(),
    replaceMatchesForEntry: vi.fn(),
  },
}));
vi.mock("@/lib/claude", () => ({ matchEntry: vi.fn() }));

import { db } from "@/lib/db";
import { matchEntry } from "@/lib/claude";
import { PUT, DELETE } from "@/app/api/entries/[id]/route";

afterEach(() => vi.clearAllMocks());

test("PUT updates an entry, runs matching, and reports matched count", async () => {
  (db.updateEntry as any).mockResolvedValue({ id: 1, body: "updated", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (db.listQuestions as any).mockResolvedValue([{ id: 9, text: "deadline?", companyTags: [], createdAt: "" }]);
  (matchEntry as any).mockResolvedValue([{ questionId: 9, strength: "strong", reason: "x" }]);
  (db.replaceMatchesForEntry as any).mockResolvedValue(undefined);

  const req = new Request("http://t/api/entries/1", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "updated", occurredOn: "2026-06-01", tags: [] }),
  });
  const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.matchedCount).toBe(1);
  expect(db.updateEntry).toHaveBeenCalledWith(1, "updated", "2026-06-01", []);
  expect(db.replaceMatchesForEntry).toHaveBeenCalledWith(1, [{ questionId: 9, strength: "strong", reason: "x" }]);
});

test("PUT with omitted occurredOn calls db.updateEntry with null and does not 500", async () => {
  (db.updateEntry as any).mockResolvedValue({ id: 1, body: "updated", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (db.listQuestions as any).mockResolvedValue([]);
  (matchEntry as any).mockResolvedValue([]);
  (db.replaceMatchesForEntry as any).mockResolvedValue(undefined);

  const req = new Request("http://t/api/entries/1", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "updated" }),
  });
  const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });

  expect(res.status).toBe(200);
  expect(db.updateEntry).toHaveBeenCalledWith(1, "updated", null, []);
});

test("PUT rejects an empty body", async () => {
  const req = new Request("http://t/api/entries/1", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "  " }),
  });
  const res = await PUT(req, { params: Promise.resolve({ id: "1" }) });
  expect(res.status).toBe(400);
  expect(db.updateEntry).not.toHaveBeenCalled();
});

test("PUT still returns the entry with matchedCount null if matching fails", async () => {
  (db.updateEntry as any).mockResolvedValue({ id: 2, body: "x", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (db.listQuestions as any).mockResolvedValue([{ id: 9, text: "q", companyTags: [], createdAt: "" }]);
  (matchEntry as any).mockRejectedValue(new Error("claude down"));

  const req = new Request("http://t/api/entries/2", {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "x" }),
  });
  const res = await PUT(req, { params: Promise.resolve({ id: "2" }) });
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.entry.id).toBe(2);
  expect(json.matchedCount).toBe(null);
});

test("DELETE removes the entry", async () => {
  (db.deleteEntry as any).mockResolvedValue(undefined);

  const req = new Request("http://t/api/entries/1", { method: "DELETE" });
  const res = await DELETE(req, { params: Promise.resolve({ id: "1" }) });
  const json = await res.json();

  expect(db.deleteEntry).toHaveBeenCalledWith(1);
  expect(json).toEqual({ ok: true });
});
