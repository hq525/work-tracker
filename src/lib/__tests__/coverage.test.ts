import { expect, test } from "vitest";
import { computeCoverage } from "@/lib/coverage";
import type { Question, Match } from "@/lib/types";

const q1: Question = { id: 1, text: "deadline", companyTags: ["stripe"], createdAt: "" };
const q2: Question = { id: 2, text: "conflict", companyTags: ["google"], createdAt: "" };
const matches: Match[] = [
  { id: 1, entryId: 10, questionId: 1, strength: "strong", reason: "" },
  { id: 2, entryId: 11, questionId: 1, strength: "weak", reason: "" },
];

test("aggregates counts and best strength per question", () => {
  const rows = computeCoverage([q1, q2], matches);
  const r1 = rows.find((r) => r.question.id === 1)!;
  expect(r1).toMatchObject({ total: 2, strong: 1, weak: 1, best: "strong" });
  const r2 = rows.find((r) => r.question.id === 2)!;
  expect(r2).toMatchObject({ total: 0, strong: 0, weak: 0, best: "none" });
});

test("company tag filter narrows the question set", () => {
  const rows = computeCoverage([q1, q2], matches, "google");
  expect(rows.map((r) => r.question.id)).toEqual([2]);
});
