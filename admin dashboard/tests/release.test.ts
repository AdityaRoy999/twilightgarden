import { describe, it, expect } from "vitest";
import { releaseInput, mapRun, buildWorkflow } from "../backend/domain";
// Imports only validation; the script executes CI publishing only when run directly.
import { validateRelease } from "../../scripts/publish-native-release.mjs";
describe("release automation validation", () => {
  const valid = {
    version: "0.1.0",
    platforms: ["android", "ios", "dmg"],
    notes: "Improved synchronization.",
    publish: false,
    requestId: "79d39a4a-9130-4834-bb2f-a2a226b8d693",
  };
  it("accepts a release for a subset of known platforms", () => {
    expect(releaseInput.parse(valid).platforms).toHaveLength(3);
    expect(() => validateRelease(valid)).not.toThrow();
  });
  it.each([
    { version: "0.0.0" },
    { version: "1.0.0;command" },
    { platforms: ["shell"] },
    { platforms: ["ios", "ios"] },
    { platforms: [] },
    { notes: "x" },
    { notes: "x".repeat(10001) },
  ])("rejects invalid options in both the API and publisher %#", (patch) => {
    const input = { ...valid, ...patch };
    expect(() => releaseInput.parse(input)).toThrow();
    expect(() => validateRelease(input)).toThrow();
  });
  it("does not accept arbitrary workflow or ref overrides", () => {
    expect(() => releaseInput.parse({ ...valid, ref: "feature" })).toThrow();
  });
  it("recognizes the macOS and release orchestrator runs", () => {
    expect(mapRun({ path: ".github/workflows/macos-dmg.yml" }).platform).toBe(
      "dmg",
    );
    expect(
      mapRun({ path: ".github/workflows/native-release.yml" }).platform,
    ).toBe("release");
    expect(
      buildWorkflow(
        { head_branch: "main", path: ".github/workflows/native-release.yml" },
        "main",
      ),
    ).toBe(true);
  });
});
