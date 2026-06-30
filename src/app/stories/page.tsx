"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../_components/Nav";

interface Story { id: number; title: string; body: string; }

export default function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => { fetch("/api/stories").then((r) => r.json()).then(setStories); }, []);
  return (
    <>
      <Nav />
      <Link href="/stories/new">+ New story</Link>
      {stories.map((s) => (
        <article key={s.id}>
          <h3>{s.title}</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{s.body}</pre>
        </article>
      ))}
    </>
  );
}
