import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { listEntries: vi.fn(), createStory: vi.fn() },
}));
vi.mock("@/lib/claude", () => ({ generateStory: vi.fn() }));

import { db } from "@/lib/db";
import { generateStory } from "@/lib/claude";
import { POST as GENERATE } from "@/app/api/stories/generate/route";
import { POST as SAVE } from "@/app/api/stories/route";

afterEach(() => vi.clearAllMocks());

test("generate requires at least one entry id", async () => {
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ entryIds: [] }) });
  const res = await GENERATE(req);
  expect(res.status).toBe(400);
});

test("generate passes selected entries to Claude and returns markdown", async () => {
  (db.listEntries as any).mockResolvedValue([
    { id: 1, body: "a", occurredOn: "", createdAt: "", tags: [] },
    { id: 2, body: "b", occurredOn: "", createdAt: "", tags: [] },
  ]);
  (generateStory as any).mockResolvedValue("**Situation** ...");
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ entryIds: [2], promptContext: "deadline" }) });
  const res = await GENERATE(req);
  const json = await res.json();
  expect(json.body).toContain("Situation");
  expect((generateStory as any).mock.calls[0][0]).toEqual([{ id: 2, body: "b", occurredOn: "", createdAt: "", tags: [] }]);
  expect((generateStory as any).mock.calls[0][1]).toBe("deadline");
});

test("save persists the story with its source entry ids", async () => {
  (db.createStory as any).mockResolvedValue({ id: 5, title: "T", promptContext: null, body: "B", sourceEntryIds: [2], createdAt: "" });
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ title: "T", promptContext: null, body: "B", sourceEntryIds: [2] }) });
  const res = await SAVE(req);
  const json = await res.json();
  expect(json.id).toBe(5);
  expect(db.createStory).toHaveBeenCalledWith("T", null, "B", [2]);
});
