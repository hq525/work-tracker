import Link from "next/link";

export default function Nav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
      <Link href="/">Capture</Link>
      <Link href="/stories">Stories</Link>
      <Link href="/questions">Questions</Link>
      <Link href="/coverage">Coverage</Link>
    </nav>
  );
}
