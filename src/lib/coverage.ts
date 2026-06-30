import type { Question, Match, Strength } from "./types";

export interface CoverageRow {
  question: Question;
  total: number;
  strong: number;
  weak: number;
  best: Strength | "none";
}

export function computeCoverage(questions: Question[], matches: Match[], companyTag?: string): CoverageRow[] {
  const selected = companyTag
    ? questions.filter((q) => q.companyTags.includes(companyTag))
    : questions;
  return selected.map((question) => {
    const m = matches.filter((x) => x.questionId === question.id);
    const strong = m.filter((x) => x.strength === "strong").length;
    const weak = m.filter((x) => x.strength === "weak").length;
    const best: Strength | "none" = strong > 0 ? "strong" : weak > 0 ? "weak" : "none";
    return { question, total: m.length, strong, weak, best };
  });
}
