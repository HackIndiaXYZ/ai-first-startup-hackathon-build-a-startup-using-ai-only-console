import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Only the retained local development database is modified. Hosted migrations
// are applied by Sites during deployment, never by an application request.
const root = process.cwd();
const state = path.join(root, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
if (!existsSync(state)) throw Error("Start npm run dev once to initialise the local database, then rerun db:local.");
const candidates = readdirSync(state).filter(name => name.endsWith(".sqlite") && name !== "metadata.sqlite");
if (candidates.length !== 1) throw Error("Expected exactly one local D1 application database. Choose its binding before migrating.");
const database = new DatabaseSync(path.join(state, candidates[0]));
database.exec("PRAGMA busy_timeout=5000");
const backup = path.join(root, ".wrangler", `before-pharma-${Date.now()}.sqlite`);
database.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
database.exec("CREATE TABLE IF NOT EXISTS _recallscope_local_migrations(name TEXT PRIMARY KEY,applied_at TEXT NOT NULL)");
for (const name of readdirSync(path.join(root, "drizzle")).filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
  if (database.prepare("SELECT 1 FROM _recallscope_local_migrations WHERE name=?").get(name)) continue;
  const legacyTable = name.startsWith("0000_") ? "workspaces" : name.startsWith("0001_") ? "ai_request_usage" : null;
  const exists = legacyTable && database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(legacyTable);
  database.exec("BEGIN IMMEDIATE");
  try {
    if (!exists) database.exec(readFileSync(path.join(root, "drizzle", name), "utf8").replaceAll("--> statement-breakpoint", ""));
    database.prepare("INSERT INTO _recallscope_local_migrations(name,applied_at) VALUES (?,?)").run(name, new Date().toISOString());
    database.exec("COMMIT");
    process.stdout.write(`${exists ? "Retained existing" : "Applied"} ${name}\n`);
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}
database.close();
process.stdout.write("Local database ready; a pre-migration backup is retained in .wrangler.\n");
