"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../_components/Nav";

interface Story { id: number; title: string; body: string; }

export default function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/stories").then((r) => r.json()).then((s) => { setStories(s); setLoaded(true); });
  }, []);

  return (
    <>
      <Nav />
      <main id="main" className="container">
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1>Stories</h1>
            <p>Interview-ready stories generated from your entries.</p>
          </div>
          <Link href="/stories/new" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New story
          </Link>
        </div>

        {!loaded ? null : stories.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
            <h3>No stories yet</h3>
            <p>Pick a few entries and generate your first story.</p>
            <Link href="/stories/new" className="btn btn-ghost" style={{ marginTop: "var(--space-4)" }}>Create a story</Link>
          </div>
        ) : (
          <div className="stack">
            {stories.map((s) => (
              <article key={s.id} className="card card-pad">
                <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-2)" }}>{s.title}</h2>
                <p className="prose">{s.body}</p>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
