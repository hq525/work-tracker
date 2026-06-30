import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchQuestion } from "@/lib/claude";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { text, companyTags } = await req.json();
  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const question = await db.updateQuestion(Number(id), text.trim(), Array.isArray(companyTags) ? companyTags : []);
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

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.deleteQuestion(Number(id));
  return NextResponse.json({ ok: true });
}
