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

// 프로젝트가 direct connection(db.<ref>.supabase.co)을 안 내주는 최신 인프라라(IPv6 전용,
// 이 환경은 IPv6 라우팅이 안 됨) Session Pooler를 쓴다. 풀러 리전은 프로젝트마다 다르니
// (예: bgqnwhazfqvdwkyetxsz는 ap-northeast-1, uepzzndhofribmbqdfbq는 ap-southeast-2였음)
// .env.local의 SUPABASE_POOLER_HOST로 오버라이드 가능하게 하고, 기본값만 하나 잡아둔다.
const poolerHost = (() => {
  try {
    return envVar("SUPABASE_POOLER_HOST");
  } catch {
    return "aws-0-ap-northeast-1.pooler.supabase.com";
  }
})();

const client = new Client({
  host: poolerHost,
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
