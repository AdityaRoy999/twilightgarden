// Run via npm run setup:turn. Only Cloudflare TURN settings are uploaded.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
config({ quiet: true });
const names = [
  "CLOUDFLARE_TURN_KEY_ID",
  "CLOUDFLARE_TURN_API_TOKEN",
  "CLOUDFLARE_TURN_TTL",
];
const values = names.map((name) => [
  name,
  process.env[name] || (name.endsWith("_TTL") ? "3600" : ""),
]);
if (values.some(([, value]) => !value || !/^[-\w.]+$/.test(value)))
  throw new Error(
    "Fill the Cloudflare TURN key ID and API token in .env first.",
  );
const ttl = Number(values[2][1]);
if (!Number.isInteger(ttl) || ttl < 600 || ttl > 86400)
  throw new Error("CLOUDFLARE_TURN_TTL must be 600–86400 seconds.");
const project = new URL(process.env.VITE_SUPABASE_URL || "").hostname.split(
  ".",
)[0];
if (project !== "awijrkxrhlisixufiukw")
  throw new Error("The .env must point to the Twilight Supabase project.");
const npx = path.join(
  path.dirname(process.env.npm_execpath || ""),
  "npx-cli.js",
);
if (!fs.existsSync(npx))
  throw new Error("Run this script with npm run setup:turn.");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "twilight-turn-")),
  file = path.join(directory, "turn.env");
try {
  fs.writeFileSync(
    file,
    values.map(([name, value]) => `${name}=${value}`).join("\n") + "\n",
    { mode: 0o600 },
  );
  const result = spawnSync(
    process.execPath,
    [
      npx,
      "--yes",
      "supabase",
      "secrets",
      "set",
      "--project-ref",
      project,
      "--env-file",
      file,
    ],
    { stdio: "inherit" },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      "Could not publish TURN secrets. Run npx supabase login, then retry.",
    );
  console.log(
    "Cloudflare TURN secrets configured. No frontend rebuild is needed.",
  );
} finally {
  fs.rmSync(file, { force: true });
  fs.rmdirSync(directory);
}
