"use client";
import { useEffect, useState } from "react";
import Nav from "./_components/Nav";

interface Entry { id: number; occurredOn: string; body: string; tags: string[]; }

function formatDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/entries");
    setEntries(await res.json());
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim() === "") return;
    setSaving(true);
    const res = await fetch("/api/entries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    const json = await res.json();
    setSaving(false);
    setNote(json.matchedCount === null ? "Saved — matching unavailable" : `Saved — matched ${json.matchedCount} question(s)`);
    setBody(""); setTags("");
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <Nav />
      <main id="main" className="container">
        <div className="page-head">
          <h1>Capture</h1>
          <p>Jot down what you did today. Small wins add up to great interview stories.</p>
        </div>

        <form className="card card-pad stack" onSubmit={save} style={{ marginBottom: "var(--space-6)" }}>
          <div className="field">
            <label className="label" htmlFor="entry-body">What did you do?</label>
            <textarea
              id="entry-body"
              className="textarea"
              autoFocus
              rows={3}
              value={body}
              placeholder="Shipped the new onboarding flow, cut signup drop-off by 12%…"
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="entry-tags">Tags</label>
            <input
              id="entry-tags"
              className="input"
              value={tags}
              placeholder="leadership, shipping, mentoring"
              onChange={(e) => setTags(e.target.value)}
            />
            <span className="helper">Comma-separated. Optional.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <button type="submit" className="btn btn-primary" disabled={saving || body.trim() === ""}>
              {saving ? "Saving…" : "Save entry"}
            </button>
            {note && (
              <span className="note" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {note}
              </span>
            )}
          </div>
        </form>

        {!loaded ? null : entries.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M9 13h6M9 17h4" />
            </svg>
            <h3>No entries yet</h3>
            <p>Your first entry will show up here.</p>
          </div>
        ) : (
          <ul className="list">
            {entries.map((e) => (
              <li key={e.id} className="item">
                <div className="item-body">
                  <span className="meta">{formatDate(e.occurredOn)}</span>
                  <p className="text">{e.body}</p>
                  {e.tags.length > 0 && (
                    <div className="tag-row" style={{ marginTop: "var(--space-2)" }}>
                      {e.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
                <button className="icon-btn" onClick={() => remove(e.id)} aria-label="Delete entry">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
