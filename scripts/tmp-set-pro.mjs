import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const rootDir = "C:/Users/user/Desktop/강화학습/choreohub";
const envText = fs.readFileSync(path.join(rootDir, ".env.local"), "utf8");
function envVar(name) {
  const m = envText.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!m) throw new Error(`${name} not found in .env.local`);
  return m[1].trim().replace(/^"(.*)"$/, "$1");
}

const supabaseUrl = envVar("SUPABASE_URL");
const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const password = envVar("SUPABASE_DB_PASSWORD");
const poolerHost = envVar("SUPABASE_POOLER_HOST");

const client = new Client({
  host: poolerHost,
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const res = await client.query(`
  update public.profiles
  set plan = 'pro', pro_expires_at = now() + interval '7 days'
  returning id, plan, pro_expires_at, name;
`);
console.log(res.rows);
await client.end();
