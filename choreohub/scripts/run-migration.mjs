import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envText = fs.readFileSync(path.join(rootDir, ".env.local"), "utf8");
function envVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) throw new Error(`${name} not found in .env.local`);
  // `vercel env pull`은 값을 큰따옴표로 감싸서 쓴다 — 있으면 벗겨낸다.
  return m[1].trim().replace(/^"(.*)"$/, "$1");
}

const supabaseUrl = envVar("SUPABASE_URL");
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const password = envVar("SUPABASE_DB_PASSWORD");

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error("Usage: node scripts/run-migration.mjs <path-to-sql>");
  process.exit(1);
}
const sql = fs.readFileSync(migrationPath, "utf8");

// 프로젝트가 direct connection(db.<ref>.supabase.co)을 안 내주는 최신 인프라라
// Session Pooler를 쓴다 — 실제로 접속되는 리전을 확인해서 ap-northeast-1로 고정함.
const client = new Client({
  host: "aws-0-ap-northeast-1.pooler.supabase.com",
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("connected, running migration...");
  await client.query(sql);
  console.log("migration applied successfully");
} catch (err) {
  console.error("migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
