import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await db.listStories());
}

export async function POST(req: Request) {
  const { title, promptContext, body, sourceEntryIds } = await req.json();
  if (typeof title !== "string" || typeof body !== "string") {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }
  const story = await db.createStory(
    title, promptContext ?? null, body,
    Array.isArray(sourceEntryIds) ? sourceEntryIds.map(Number) : [],
  );
  return NextResponse.json(story);
}
