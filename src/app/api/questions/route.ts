import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchQuestion } from "@/lib/claude";

export async function GET() {
  return NextResponse.json(await db.listQuestions());
}

export async function POST(req: Request) {
  const { text, companyTags } = await req.json();
  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const question = await db.createQuestion(text.trim(), Array.isArray(companyTags) ? companyTags : []);
  let matchedCount: number | null = null;
  try {
    const rows = await matchQuestion(question, await db.listEntries());
    await db.replaceMatchesForQuestion(question.id, rows);
    matchedCount = rows.length;
  } catch {
    matchedCount = null;
  }
  return NextResponse.json({ question, matchedCount });
}
