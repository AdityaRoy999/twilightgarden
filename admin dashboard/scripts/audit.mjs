import { spawnSync } from "node:child_process";
// npm classifies some bundled CDK dependencies as production even though CDK is
// dev-only. Explicitly report the known upstream tooling exception, never hide it.
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--json"],
  { encoding: "utf8", shell: process.platform === "win32" },
);
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error("npm audit did not return a valid report.");
  process.exit(1);
}
if (report.error) {
  console.error("npm audit failed:", report.error.code);
  process.exit(1);
}
const blocked = [];
for (const [name, finding] of Object.entries(report.vulnerabilities || {})) {
  const advisory = finding.via || [];
  const knownCdkBundle =
    (name === "minimatch" || name === "aws-cdk-lib") &&
    finding.severity === "moderate" &&
    finding.nodes.every(
      (n) =>
        n === "node_modules/aws-cdk-lib" ||
        n.startsWith("node_modules/aws-cdk-lib/node_modules/"),
    ) &&
    advisory.every((v) =>
      typeof v === "string"
        ? v === "minimatch"
        : v.url === "https://github.com/advisories/GHSA-g3hv-75wg-m249",
    );
  if (knownCdkBundle) {
    console.warn(
      `KNOWN TOOLING ADVISORY: ${name} — bundled CDK minimatch. See SECURITY.md. This is not a clean full dependency audit.`,
    );
    continue;
  }
  if (["moderate", "high", "critical"].includes(finding.severity))
    blocked.push(`${name}: ${finding.severity}`);
}
if (blocked.length) {
  console.error(blocked.join("\n"));
  process.exit(1);
}
console.log(
  "No unacknowledged moderate/high/critical findings. Review the known CDK tooling advisory before deployment.",
);
