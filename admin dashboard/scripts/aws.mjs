import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
export function aws(args) {
  return execFileSync(process.platform === "win32" ? "aws.exe" : "aws", args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });
}
export function outputs() {
  const all = JSON.parse(
    readFileSync(new URL("../deployment.local.json", import.meta.url), "utf8"),
  );
  const data = all.TwilightControl;
  if (!data?.SiteUrl || !data?.UserPoolId)
    throw new Error("Missing stack outputs. Run npm run infra:deploy first.");
  return data;
}
