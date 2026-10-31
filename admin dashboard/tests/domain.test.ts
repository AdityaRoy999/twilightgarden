import { describe, it, expect } from "vitest";
import {
  buildInput,
  buildWorkflow,
  HttpError,
  mapRun,
  parseBody,
  positiveId,
  requireAdmin,
  safeDownloadUrl,
} from "../backend/domain";
describe("admin authorization", () => {
  const valid = {
    sub: "admin-1",
    token_use: "access",
    scope: "openid twilight-admin/control",
    "cognito:groups": ["admins"],
  };
  it("accepts access tokens for invited admins, including API Gateway string claims", () => {
    expect(requireAdmin(valid)).toBe("admin-1");
    expect(requireAdmin({ ...valid, "cognito:groups": "[admins]" })).toBe(
      "admin-1",
    );
  });
  it.each([
    undefined,
    {},
    { ...valid, token_use: "id" },
    { ...valid, scope: "openid" },
    { ...valid, "cognito:groups": ["not-admins"] },
    { ...valid, sub: "" },
  ])("rejects non-admin or wrong token claims %#", (claims) =>
    expect(() => requireAdmin(claims)).toThrow(HttpError),
  );
});
describe("mutation boundaries", () => {
  it("rejects arbitrary workflows, refs, extra fields, and invalid IDs", () => {
    const requestId = "79d39a4a-9130-4834-bb2f-a2a226b8d693";
    expect(
      parseBody(JSON.stringify({ platform: "ios", requestId }), buildInput)
        .platform,
    ).toBe("ios");
    for (const body of [
      { platform: "shell", requestId },
      { platform: "ios", requestId, ref: "untrusted" },
      { platform: "ios", requestId: "x" },
    ])
      expect(() => parseBody(JSON.stringify(body), buildInput)).toThrow();
    for (const id of ["../x", "0", "9007199254740992", "-1"])
      expect(() => positiveId(id)).toThrow();
  });
  it("controls only known mobile workflows on main", () => {
    expect(
      buildWorkflow(
        { head_branch: "main", path: ".github/workflows/ios-unsigned.yml" },
        "main",
      ),
    ).toBe(true);
    expect(
      buildWorkflow(
        { head_branch: "feature", path: ".github/workflows/ios-unsigned.yml" },
        "main",
      ),
    ).toBe(false);
    expect(
      buildWorkflow(
        { head_branch: "main", path: ".github/workflows/verify.yml" },
        "main",
      ),
    ).toBe(false);
  });
  it("only releases HTTPS artifact provider URLs", () => {
    expect(
      safeDownloadUrl(
        "https://test.blob.core.windows.net/file?sig=short-lived",
      ),
    ).toContain("https://");
    for (const u of [
      "http://test.blob.core.windows.net/x",
      "https://evil.example/x",
      "https://github.com.evil.example/x",
      "https://user:pass@test.blob.core.windows.net/x",
    ])
      expect(() => safeDownloadUrl(u)).toThrow();
  });
  it("normalizes durations from execution start instead of queue time", () => {
    const r = mapRun({
      id: 1,
      path: ".github/workflows/android-apk.yml",
      status: "completed",
      conclusion: "success",
      head_branch: "main",
      head_sha: "abc",
      created_at: "2026-10-30T10:00:00Z",
      run_started_at: "2026-10-30T10:10:00Z",
      updated_at: "2026-10-30T10:13:00Z",
    });
    expect(r.duration).toBe(180);
    expect(r.platform).toBe("android");
  });
});
