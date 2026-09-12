import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const localPath = (path) => fileURLToPath(new URL("../" + path, import.meta.url));
const envFile = localPath(".env");
const child = spawn(process.execPath, [
  "--import", new URL("./sites-env.mjs", import.meta.url).href,
  localPath("node_modules/wrangler/bin/wrangler.js"), "dev",
  "--config", localPath("dist/server/wrangler.json"),
  ...(existsSync(envFile) ? ["--env-file", envFile] : []),
  "--local", "--persist-to", localPath(".wrangler/state"),
  "--ip", "127.0.0.1", "--inspector-port", "0",
  ...process.argv.slice(2),
], {cwd: root, stdio:"inherit"});
child.on("error", () => { console.error("The built preview could not start. Run npm ci and npm run build first."); process.exitCode=1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for(const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>child.kill(signal));
