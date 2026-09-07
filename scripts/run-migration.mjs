// Runs a .sql file against the Supabase project via the Management API.
// Usage: node scripts/run-migration.mjs supabase/setup-store-view.sql
// Requires SUPABASE_ACCESS_TOKEN (Personal Access Token, sbp_...) in .env.local
import { readFile } from "fs/promises";
import path from "path";

const PROJECT_REF = "wlynwymobvcwxjpozkqi";

async function loadEnv() {
  const envPath = path.resolve(import.meta.dirname, "..", ".env.local");
  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

await loadEnv();

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("ERRO: SUPABASE_ACCESS_TOKEN vazio no .env.local");
  process.exit(1);
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Uso: node scripts/run-migration.mjs <arquivo.sql>");
  process.exit(1);
}

const sql = await readFile(path.resolve(import.meta.dirname, "..", sqlFile), "utf8");

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const text = await res.text();
if (!res.ok) {
  console.error(`FALHOU (${res.status}): ${text}`);
  process.exit(1);
}
console.log(`OK (${res.status})`);
console.log(text);
