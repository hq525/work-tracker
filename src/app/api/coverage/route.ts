import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCoverage } from "@/lib/coverage";

export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company") ?? undefined;
  const [questions, matches] = await Promise.all([db.listQuestions(), db.listMatches()]);
  return NextResponse.json(computeCoverage(questions, matches, company));
}
