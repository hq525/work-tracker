"use client";
import { useEffect, useState } from "react";
import Nav from "../_components/Nav";

interface Row {
  question: { id: number; text: string; companyTags: string[] };
  total: number; strong: number; weak: number; best: "strong" | "weak" | "none";
}

function badge(r: Row): string {
  if (r.best === "none") return "❌ no match — gap";
  if (r.best === "strong") return `✅ ${r.total} match(es) (${r.strong} strong)`;
  return `⚠️ ${r.total} weak match(es)`;
}

export default function Coverage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [company, setCompany] = useState("");

  async function load() {
    const url = company ? `/api/coverage?company=${encodeURIComponent(company)}` : "/api/coverage";
    setRows(await (await fetch(url)).json());
  }
  useEffect(() => { load(); }, [company]);

  return (
    <>
      <Nav />
      <input value={company} placeholder="filter by company tag" onChange={(e) => setCompany(e.target.value)} />
      <ul>
        {rows.map((r) => (
          <li key={r.question.id}>
            <strong>{badge(r)}</strong> — {r.question.text}
          </li>
        ))}
      </ul>
    </>
  );
}
