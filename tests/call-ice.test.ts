import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("../lib/supabase", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));
import { loadCallIce } from "../lib/callIce";
beforeEach(() => mocks.invoke.mockReset());
describe("short-lived Cloudflare TURN credentials", () => {
  it("uses authenticated backend credentials and filters browser-blocked port 53", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        expiresAt: Date.now() + 3600000,
        iceServers: [
          {
            urls: [
              "stun:stun.cloudflare.com:3478",
              "turn:turn.cloudflare.com:53?transport=udp",
              "turns:turn.cloudflare.com:443?transport=tcp",
            ],
            username: "synthetic",
            credential: "short-lived",
          },
        ],
      },
      error: null,
    });
    const result = await loadCallIce("pair");
    expect(mocks.invoke).toHaveBeenCalledWith(
      "call-credentials",
      expect.objectContaining({ body: { coupleId: "pair" } }),
    );
    expect(result.relayConfigured).toBe(true);
    expect(result.iceServers[0].urls).not.toContain(
      "turn:turn.cloudflare.com:53?transport=udp",
    );
  });
  it("allows direct calls only when the backend explicitly reports missing configuration", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(JSON.stringify({ code: "TURN_NOT_CONFIGURED" }), {
          status: 503,
        }),
      },
    });
    expect((await loadCallIce("pair")).relayConfigured).toBe(false);
  });
  it("does not hide authentication errors as a working relay configuration", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { context: new Response("{}", { status: 401 }) },
    });
    await expect(loadCallIce("pair")).rejects.toThrow(/prepare/);
  });
  it("rejects expired credentials and responses with no TURN server", async () => {
    for (const data of [
      {
        expiresAt: Date.now() - 1,
        iceServers: [{ urls: "turn:relay.example" }],
      },
      {
        expiresAt: Date.now() + 3600000,
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      },
    ]) {
      mocks.invoke.mockResolvedValue({ data, error: null });
      await expect(loadCallIce("pair")).rejects.toThrow();
    }
  });
});
