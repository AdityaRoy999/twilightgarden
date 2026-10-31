import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const script = fileURLToPath(
  new URL("../../scripts/prepare-native-release.mjs", import.meta.url),
);
function fixture(platform: string, version: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "twilight-version-test-"));
  try {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ version: "0.0.3" }),
    );
    if (platform === "ios") {
      fs.mkdirSync(path.join(root, "ios/App/App.xcodeproj"), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(root, "ios/App/App.xcodeproj/project.pbxproj"),
        "MARKETING_VERSION = 1.0;\nCURRENT_PROJECT_VERSION = 1;\n",
      );
    }
    if (platform === "android") {
      fs.mkdirSync(path.join(root, "android/app"), { recursive: true });
      fs.writeFileSync(
        path.join(root, "android/app/build.gradle"),
        'versionCode 1\nversionName "1.0"\n',
      );
    }
    const run = spawnSync(process.execPath, [script], {
      cwd: root,
      env: {
        ...process.env,
        RELEASE_VERSION: version,
        NATIVE_PLATFORM: platform,
        GITHUB_RUN_NUMBER: "123",
      },
      encoding: "utf8",
    });
    return {
      status: run.status,
      pkg: JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")),
      native:
        platform === "ios"
          ? fs.readFileSync(
              path.join(root, "ios/App/App.xcodeproj/project.pbxproj"),
              "utf8",
            )
          : platform === "android"
            ? fs.readFileSync(
                path.join(root, "android/app/build.gradle"),
                "utf8",
              )
            : "",
    };
  } finally {
    const target = fs.realpathSync(root);
    const parent = fs.realpathSync(os.tmpdir());
    if (
      path.dirname(target) !== parent ||
      !path.basename(target).startsWith("twilight-version-test-")
    )
      throw new Error("Unexpected fixture cleanup path.");
    fs.rmSync(target, { recursive: true, force: true });
  }
}
describe("native release metadata", () => {
  it("stamps iOS native version and build number in an isolated checkout", () => {
    const f = fixture("ios", "0.1.0");
    expect(f.status).toBe(0);
    expect(f.pkg.version).toBe("0.1.0");
    expect(f.native).toContain("MARKETING_VERSION = 0.1.0;");
    expect(f.native).toContain("CURRENT_PROJECT_VERSION = 123;");
  });
  it("stamps Android versionName and monotonic CI build number", () => {
    const f = fixture("android", "1.2.3");
    expect(f.status).toBe(0);
    expect(f.native).toContain("versionCode 123");
    expect(f.native).toContain('versionName "1.2.3"');
  });
  it("keeps existing standalone build versions unchanged", () => {
    const f = fixture("ios", "");
    expect(f.status).toBe(0);
    expect(f.pkg.version).toBe("0.0.3");
    expect(f.native).toContain("MARKETING_VERSION = 1.0;");
  });
  it("rejects invalid version input before modifying the checkout", () => {
    const f = fixture("android", "1.2.3;echo bad");
    expect(f.status).not.toBe(0);
    expect(f.pkg.version).toBe("0.0.3");
    expect(f.native).toContain('versionName "1.0"');
  });
});
