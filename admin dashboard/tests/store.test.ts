import { beforeEach, describe, expect, it, vi } from "vitest";
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/lib-dynamodb", async (original) => {
  const actual = await original<typeof import("@aws-sdk/lib-dynamodb")>();
  return { ...actual, DynamoDBDocumentClient: { from: () => ({ send }) } };
});
import { command } from "../backend/store";
beforeEach(() => send.mockReset());
describe("durable dispatch protection", () => {
  it("does not repeat an accepted request", async () => {
    send.mockResolvedValueOnce({
      Item: { action: "build", detail: "ios", state: "accepted" },
    });
    const dispatch = vi.fn();
    expect(
      await command("admin", "id", "build", "ios", dispatch, true),
    ).toEqual({ accepted: true, duplicate: true });
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("blocks uncertain previous attempts instead of dispatching twice", async () => {
    send.mockResolvedValueOnce({
      Item: { action: "build", detail: "ios", state: "pending" },
    });
    const dispatch = vi.fn();
    await expect(
      command("admin", "id", "build", "ios", dispatch),
    ).rejects.toThrow("already attempted");
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("claims, audits, and atomically checks the pause state before dispatch", async () => {
    send.mockResolvedValue({});
    const dispatch = vi.fn().mockResolvedValue(null);
    await command("admin", "id", "build", "ios", dispatch, true);
    const transaction = send.mock.calls[1][0].input.TransactItems;
    expect(transaction).toHaveLength(3);
    expect(transaction[0].Put.ConditionExpression).toBe(
      "attribute_not_exists(pk)",
    );
    expect(transaction[2].ConditionCheck.Key.pk).toBe("SETTINGS");
    expect(dispatch).toHaveBeenCalledOnce();
  });
  it("prevents dispatch when a pause transaction is rejected", async () => {
    send
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        Object.assign(new Error(), { name: "TransactionCanceledException" }),
      );
    const dispatch = vi.fn();
    await expect(
      command("admin", "id", "build", "ios", dispatch, true),
    ).rejects.toThrow("paused");
    expect(dispatch).not.toHaveBeenCalled();
  });
});
