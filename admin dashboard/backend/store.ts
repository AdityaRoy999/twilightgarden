import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { HttpError } from "./domain";
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TableName = process.env.TABLE_NAME;
export async function settings() {
  return (
    (
      await db.send(
        new GetCommand({
          TableName,
          Key: { pk: "SETTINGS", sk: "GLOBAL" },
          ConsistentRead: true,
        }),
      )
    ).Item || { paused: false }
  );
}
export async function auditList() {
  return (
    (
      await db.send(
        new QueryCommand({
          TableName,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": "AUDIT" },
          ScanIndexForward: false,
          Limit: 100,
        }),
      )
    ).Items || []
  ).map(({ pk, sk, ttl, ...item }) => item);
}
export async function audit(
  actor: string,
  action: string,
  detail: string,
  outcome = "accepted",
) {
  const at = new Date().toISOString();
  const id = randomUUID();
  await db.send(
    new PutCommand({
      TableName,
      Item: {
        pk: "AUDIT",
        sk: `${at}#${id}`,
        id,
        at,
        actor,
        action,
        detail,
        outcome,
        ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
      },
    }),
  );
}
export async function pause(actor: string, paused: boolean) {
  // Commit the audit record with the setting; no unaudited setting changes.
  const at = new Date().toISOString();
  const id = randomUUID();
  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName, Item: { pk: "SETTINGS", sk: "GLOBAL", paused } } },
        {
          Put: {
            TableName,
            Item: {
              pk: "AUDIT",
              sk: `${at}#${id}`,
              id,
              at,
              actor,
              action: "builds.pause",
              detail: String(paused),
              outcome: "accepted",
              ttl: Math.floor(Date.now() / 1000) + 90 * 86400,
            },
          },
        },
      ],
    }),
  );
}
/** A durable claim prevents replay from dispatching a second job, even after a timeout. */
export async function command(
  actor: string,
  requestId: string,
  action: string,
  detail: string,
  fn: () => Promise<unknown>,
  checkPaused = false,
) {
  const key = { pk: `REQUEST#${actor}#${requestId}`, sk: "COMMAND" };
  const old = (
    await db.send(new GetCommand({ TableName, Key: key, ConsistentRead: true }))
  ).Item;
  if (old) {
    if (old.action !== action || old.detail !== detail)
      throw new HttpError(
        409,
        "This request ID was already used for another action.",
      );
    if (old.state === "accepted") return { accepted: true, duplicate: true };
    throw new HttpError(
      409,
      "This request was already attempted. Check GitHub or Vercel before starting another operation.",
    );
  }
  const at = new Date().toISOString();
  const id = randomUUID();
  const ttl = Math.floor(Date.now() / 1000) + 86400;
  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName,
              Item: { ...key, action, detail, state: "pending", ttl },
              ConditionExpression: "attribute_not_exists(pk)",
            },
          },
          {
            Put: {
              TableName,
              Item: {
                pk: "AUDIT",
                sk: `${at}#${id}`,
                id,
                at,
                actor,
                action: `${action}.requested`,
                detail,
                outcome: "accepted",
                ttl: ttl + 89 * 86400,
              },
            },
          },
          ...(checkPaused
            ? [
                {
                  ConditionCheck: {
                    TableName,
                    Key: { pk: "SETTINGS", sk: "GLOBAL" },
                    ConditionExpression:
                      "attribute_not_exists(paused) OR paused = :off",
                    ExpressionAttributeValues: { ":off": false },
                  },
                },
              ]
            : []),
        ],
      }),
    );
  } catch (e) {
    if ((e as Error).name === "TransactionCanceledException")
      throw new HttpError(
        409,
        "Builds may be paused or this request already exists. Refresh and check the activity log.",
      );
    throw e;
  }
  try {
    const result = await fn();
    await db.send(
      new UpdateCommand({
        TableName,
        Key: key,
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "state" },
        ExpressionAttributeValues: { ":s": "accepted" },
      }),
    );
    await audit(actor, `${action}.accepted`, detail);
    return { accepted: true, result };
  } catch (e) {
    // Leave the claim in place. An upstream timeout may still have accepted the job.
    await audit(
      actor,
      `${action}.failed`,
      `${detail} · Check upstream status before retrying.`,
      "failed",
    );
    throw e;
  }
}
