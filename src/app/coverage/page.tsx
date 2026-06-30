"use client";
import { useEffect, useState } from "react";
import Nav from "../_components/Nav";

interface Row {
  question: { id: number; text: string; companyTags: string[] };
  total: number; strong: number; weak: number; best: "strong" | "weak" | "none";
}

function StatusBadge({ r }: { r: Row }) {
  if (r.best === "none") {
    return (
      <span className="badge badge-danger">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        Gap — no match
      </span>
    );
  }
  if (r.best === "strong") {
    return (
      <span className="badge badge-success">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {r.total} match{r.total === 1 ? "" : "es"} · {r.strong} strong
      </span>
    );
  }
  return (
    <span className="badge badge-warn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      {r.total} weak match{r.total === 1 ? "" : "es"}
    </span>
  );
}

export default function Coverage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [company, setCompany] = useState("");

  async function load() {
    const url = company ? `/api/coverage?company=${encodeURIComponent(company)}` : "/api/coverage";
    setRows(await (await fetch(url)).json());
    setLoaded(true);
  }
  useEffect(() => { load(); }, [company]);

  return (
    <>
      <Nav />
      <main id="main" className="container">
        <div className="page-head">
          <h1>Coverage</h1>
          <p>Which questions you can already answer well — and where the gaps are.</p>
        </div>

        <div className="field" style={{ marginBottom: "var(--space-5)" }}>
          <label className="label" htmlFor="cov-filter">Filter by company</label>
          <input
            id="cov-filter"
            className="input"
            value={company}
            placeholder="All companies"
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        {!loaded ? null : rows.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
            <h3>Nothing to cover yet</h3>
            <p>{company ? "No questions match this company tag." : "Add some questions to see your coverage."}</p>
          </div>
        ) : (
          <ul className="list">
            {rows.map((r) => (
              <li key={r.question.id} className="item">
                <div className="item-body">
                  <StatusBadge r={r} />
                  <p className="text" style={{ marginTop: "var(--space-2)" }}>{r.question.text}</p>
                  {r.question.companyTags.length > 0 && (
                    <div className="tag-row" style={{ marginTop: "var(--space-2)" }}>
                      {r.question.companyTags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
