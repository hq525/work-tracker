import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);
  const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql(stmt);
  }
  console.log("migration complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
