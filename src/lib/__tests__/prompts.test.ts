import { expect, test } from "vitest";
import { buildStoryPrompt, buildMatchPrompt, parseMatchResponse } from "@/lib/prompts";
import type { Entry, Question } from "@/lib/types";

const entry: Entry = { id: 1, occurredOn: "2026-06-01", createdAt: "", body: "Led the DB migration under a tight deadline", tags: ["project-x"] };
const question: Question = { id: 9, createdAt: "", text: "Tell me about a time you handled a tight deadline", companyTags: ["stripe"] };

test("story prompt includes entry bodies and the question context", () => {
  const p = buildStoryPrompt([entry], "conflict with a teammate");
  expect(p).toContain("Led the DB migration");
  expect(p).toContain("conflict with a teammate");
  expect(p.toUpperCase()).toContain("STAR");
});

test("match prompt (entry target) lists candidate questions with ids", () => {
  const p = buildMatchPrompt({ kind: "entry", entry, questions: [question] });
  expect(p).toContain("Led the DB migration");
  expect(p).toContain("9");
  expect(p).toContain("tight deadline");
});

test("parseMatchResponse reads a JSON array, ignoring surrounding prose", () => {
  const text = 'Sure!\n[{"id":9,"strength":"strong","reason":"direct deadline example"}]\nDone.';
  expect(parseMatchResponse(text)).toEqual([{ id: 9, strength: "strong", reason: "direct deadline example" }]);
});

test("parseMatchResponse returns [] for an empty array", () => {
  expect(parseMatchResponse("[]")).toEqual([]);
});

test("parseMatchResponse throws on malformed output", () => {
  expect(() => parseMatchResponse("no json here")).toThrow();
});
