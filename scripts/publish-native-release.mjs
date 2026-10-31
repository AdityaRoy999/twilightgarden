import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
export function validateRelease({ version, platforms, notes }) {
  if (
    !/^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.test(
      version || "",
    ) ||
    version === "0.0.0"
  )
    throw new Error("Invalid version.");
  if (
    !Array.isArray(platforms) ||
    platforms.length < 1 ||
    platforms.length > 3 ||
    new Set(platforms).size !== platforms.length ||
    platforms.some((p) => !["android", "ios", "dmg"].includes(p))
  )
    throw new Error("Choose one or more supported platforms.");
  if (
    typeof notes !== "string" ||
    notes.trim().length < 5 ||
    notes.length > 10000
  )
    throw new Error("Release notes must be 5–10000 characters.");
}
async function run() {
  const version = process.env.RELEASE_VERSION;
  const platforms = JSON.parse(process.env.RELEASE_PLATFORMS || "[]");
  const notes = process.env.RELEASE_NOTES;
  validateRelease({ version, platforms, notes });
  if (process.env.GITHUB_REF !== "refs/heads/main")
    throw new Error("Releases must be dispatched on main.");
  const repo = process.env.GITHUB_REPOSITORY;
  const sha = process.env.GITHUB_SHA;
  const tag = `v${version}`;
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repo || "") ||
    !/^[a-f0-9]{40}$/.test(sha || "")
  )
    throw new Error("Invalid CI repository/commit.");
  const response = await fetch(
    `https://api.github.com/repos/${repo}/git/ref/tags/${tag}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (response.status !== 404)
    throw new Error(
      response.ok
        ? "This tag already exists. Use a new version."
        : "Unable to verify that the tag is unused.",
    );
  if (process.argv[2] === "validate") {
    console.log(`Validated ${tag} for ${platforms.join(", ")}.`);
    return;
  }
  if (process.argv[2] !== "ship") throw new Error("Expected validate or ship.");
  const roots = {
    android: "TwilightGarden-Android-APK",
    ios: "TwilightGarden-unsigned-iOS",
    dmg: "TwilightGarden-macOS-DMG",
  };
  const extensions = { android: ".apk", ios: ".ipa", dmg: ".dmg" };
  const out = "release-package";
  fs.mkdirSync(out, { recursive: true });
  const assets = [];
  const checksums = [];
  for (const platform of platforms) {
    const folder = path.join("release-artifacts", roots[platform]);
    const files = fs
      .readdirSync(folder)
      .filter((f) => f.endsWith(extensions[platform]));
    if (files.length !== 1)
      throw new Error(`Expected exactly one ${platform} installer.`);
    const suffix =
      platform === "ios"
        ? "unsigned"
        : platform === "android"
          ? "debug"
          : "apple-silicon-adhoc";
    const name = `TwilightGarden-${version}-${suffix}${extensions[platform]}`;
    const target = path.join(out, name);
    fs.copyFileSync(path.join(folder, files[0]), target);
    checksums.push(
      `${createHash("sha256").update(fs.readFileSync(target)).digest("hex")}  ${name}`,
    );
    assets.push(target);
  }
  const manifest = {
    version,
    tag,
    commit: sha,
    run: process.env.GITHUB_RUN_ID,
    platforms,
    builtAt: new Date().toISOString(),
    signing: {
      android: "debug-signed; not a production Android release",
      ios: "unsigned; Sideloadly signing required",
      dmg: "Apple Silicon; ad-hoc signed; not notarized",
    },
  };
  fs.writeFileSync(
    path.join(out, "build-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(out, "SHA256SUMS.txt"),
    checksums.join("\n") + "\n",
  );
  assets.push(
    path.join(out, "build-manifest.json"),
    path.join(out, "SHA256SUMS.txt"),
  );
  const notesFile = path.join(out, "release-notes.md");
  fs.writeFileSync(
    notesFile,
    notes +
      `\n\n---\nSource: ${sha}\n\nTest distribution: Android debug signing; iOS unsigned; macOS Apple Silicon ad-hoc signing without notarization. Installation/signing requirements still apply.\n`,
  );
  // Array arguments: notes and tags are never interpolated into a shell command.
  const args = [
    "release",
    "create",
    tag,
    "--repo",
    repo,
    "--target",
    sha,
    "--title",
    `Twilight Garden ${version}`,
    "--notes-file",
    notesFile,
    ...(process.env.RELEASE_PUBLISH === "true" ? [] : ["--draft"]),
    ...assets,
  ];
  execFileSync("gh", args, { stdio: "inherit" });
  console.log(
    `${process.env.RELEASE_PUBLISH === "true" ? "Published" : "Drafted"} ${tag} from ${sha}.`,
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await run();
