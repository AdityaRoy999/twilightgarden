import { beforeEach, describe, it, expect, vi } from "vitest";
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from "aws-lambda";
const mocks = vi.hoisted(() => ({
  github: vi.fn(),
  integrations: vi.fn(),
  command: vi.fn(),
  pause: vi.fn(),
  audit: vi.fn(),
  settings: vi.fn(),
  auditList: vi.fn(),
  metrics: vi.fn(),
}));
vi.mock("../backend/github", () => ({
  github: mocks.github,
  integrations: mocks.integrations,
}));
vi.mock("../backend/store", () => ({
  command: mocks.command,
  pause: mocks.pause,
  audit: mocks.audit,
  settings: mocks.settings,
  auditList: mocks.auditList,
}));
vi.mock("../backend/metrics", () => ({ metrics: mocks.metrics }));
import { handler } from "../backend/handler";
function event(
  path: string,
  method = "GET",
  body?: unknown,
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    rawPath: path,
    headers: { origin: "https://admin.example" },
    isBase64Encoded: false,
    body: body ? JSON.stringify(body) : undefined,
    requestContext: {
      requestId: "req",
      http: { method },
      authorizer: {
        jwt: {
          claims: {
            sub: "a1",
            token_use: "access",
            scope: "twilight-admin/control",
            "cognito:groups": "admins",
          },
        },
      },
    },
  } as APIGatewayProxyEventV2WithJWTAuthorizer;
}
beforeEach(() => {
  vi.clearAllMocks();
  process.env.SITE_ORIGIN = "https://admin.example";
  process.env.BUILD_BRANCH = "main";
  mocks.command.mockImplementation(async (_a, _id, _type, _detail, fn) => ({
    accepted: true,
    result: await fn(),
  }));
});
describe("admin API routes", () => {
  it("rejects anonymous requests before touching integrations", async () => {
    const e = event("/snapshot");
    delete (e.requestContext as any).authorizer;
    expect((await handler(e)).statusCode).toBe(403);
    expect(mocks.github).not.toHaveBeenCalled();
  });
  it("rejects foreign origins before mutations", async () => {
    const e = event("/builds", "POST", {
      platform: "ios",
      requestId: crypto.randomUUID(),
    });
    e.headers.origin = "https://evil.example";
    expect((await handler(e)).statusCode).toBe(403);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("dispatches a validated workflow on the configured branch, using the pause gate", async () => {
    mocks.github.mockResolvedValue(null);
    const result = await handler(
      event("/builds", "POST", {
        platform: "ios",
        requestId: crypto.randomUUID(),
      }),
    );
    expect(result.statusCode).toBe(202);
    expect(mocks.github).toHaveBeenCalledWith(
      "/actions/workflows/ios-unsigned.yml/dispatches",
      "POST",
      { ref: "main" },
    );
    expect(mocks.command.mock.calls[0][5]).toBe(true);
  });
  it("rejects build requests that attempt a ref override", async () => {
    expect(
      (
        await handler(
          event("/builds", "POST", {
            platform: "ios",
            requestId: crypto.randomUUID(),
            ref: "feature",
          }),
        )
      ).statusCode,
    ).toBe(400);
    expect(mocks.command).not.toHaveBeenCalled();
  });
  it("cannot cancel a verification workflow", async () => {
    mocks.github.mockResolvedValue({
      head_branch: "main",
      path: ".github/workflows/verify.yml",
    });
    expect(
      (await handler(event("/runs/123/cancel", "POST", {}))).statusCode,
    ).toBe(403);
    expect(mocks.github).toHaveBeenCalledTimes(1);
  });
  it("dispatches release notes as data with an explicit draft flag and pause gate", async () => {
    mocks.github.mockResolvedValue(null);
    const notes = "Improved sync. $(do-not-execute) `literal markdown`";
    const result = await handler(
      event("/releases", "POST", {
        version: "0.1.0",
        notes,
        platforms: ["android", "dmg"],
        publish: false,
        requestId: crypto.randomUUID(),
      }),
    );
    expect(result.statusCode).toBe(202);
    expect(mocks.github).toHaveBeenCalledWith(
      "/actions/workflows/native-release.yml/dispatches",
      "POST",
      {
        ref: "main",
        inputs: {
          version: "0.1.0",
          platforms: '["android","dmg"]',
          release_notes: notes,
          publish: false,
        },
      },
    );
    expect(mocks.command.mock.calls[0][5]).toBe(true);
    expect(mocks.command.mock.calls[0][3]).not.toContain(notes);
  });
  it("returns expired artifacts without releasing a download", async () => {
    mocks.github.mockResolvedValue({ expired: true });
    expect((await handler(event("/artifacts/456/download"))).statusCode).toBe(
      410,
    );
    expect(mocks.github).toHaveBeenCalledTimes(1);
  });
  it("never exposes an internal error or credentials to the browser", async () => {
    mocks.pause.mockRejectedValue(
      new Error("secret value should never be exposed"),
    );
    const result = await handler(event("/settings", "POST", { paused: true }));
    expect(result.statusCode).toBe(500);
    expect(result.body).not.toContain("secret value");
  });
});
