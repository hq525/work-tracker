export type Strength = "strong" | "weak";

export interface Entry {
  id: number;
  occurredOn: string; // ISO date
  createdAt: string;
  body: string;
  tags: string[];
}

export interface Story {
  id: number;
  createdAt: string;
  title: string;
  promptContext: string | null;
  body: string;
  sourceEntryIds: number[];
}

export interface Question {
  id: number;
  createdAt: string;
  text: string;
  companyTags: string[];
}

export interface Match {
  id: number;
  entryId: number;
  questionId: number;
  strength: Strength;
  reason: string;
}
