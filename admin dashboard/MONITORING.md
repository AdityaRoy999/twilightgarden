# Connect live monitoring

The deployed Metrics page reads operational aggregates through the authenticated AWS backend. It never needs user vault passwords, a Supabase service-role key, database passwords, Apple passwords, or frontend API secrets. Missing credentials show **Setup needed**; failed providers show **Unavailable**, independently of working providers.

## What the page measures

| Source | Measurements | Scope and limits |
|---|---|---|
| Supabase logs | Gateway requests/5xx, function invocations/5xx, AI gateway and call-credential requests, hourly traffic | Twilight project, last 24 hours, provider retention/sampling applies. Gateway and function counts overlap and are kept separate. Includes tests/internal traffic. |
| Supabase database | Database bytes, active connections and maximum connections, completed SQL calls, transactions, deadlocks, host memory/load, waiting pool clients | Only recognized numeric Prometheus series that the project actually exposes. Some counters are cumulative since reset, not daily or billable calls. This does not execute SQL against health records. |
| AWS infrastructure | Admin Lambda calls/errors/throttles, HTTP API traffic/4xx/5xx, DynamoDB consumed capacity, actual regional Lambda concurrency/code-storage quota | Admin stack only. The consumer backend remains Supabase. Current hour is partial; absent CloudWatch samples are unavailable. |
| AWS billing | Month-to-date charges, applied credits/refunds, net cost and service breakdown | Entire AWS account, delayed/estimated billing data. Applied credits are **not** the remaining promotional-credit balance. |
| Vercel billing | Billed cost and consumed quantities grouped by service, currency and unit | Entire configured team; billing API eligibility/role applies. Not a live app latency trace. |
| GitHub billing | Repository-specific billing quantities by SKU and net reported cost | Optional separate Plan Read token. Workflow wall-clock time is not billed runner minutes. Included usage may not appear as billable rows. |
| Cloudflare TURN | Relay ingress/egress bytes and hourly egress | One TURN key, adaptive analytics. Direct peer-to-peer media does not use TURN and is excluded. |

Supabase plan allowances/MAU/egress quotas, provider credit expiry, AI token spend and provider-specific spend caps are linked to their authoritative consoles. They are not invented or silently shown as zero. The dashboard does not currently import every provider's invoice or remaining allowance. No single total mixes different scopes, periods, or currencies.

## 1. Create the Supabase monitoring token

1. Sign in to the Supabase account that owns **Twilight**, project reference **awijrkxrhlisixufiukw**.
2. Open [Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
3. Choose **Generate new token**, then **Fine-grained**. Name it `Twilight AWS monitoring` and choose a suitable expiry.
4. Restrict resource access to Twilight's organization and **only this project**. Do not choose every organization or all projects.
5. Set **Logs → Read** (`analytics_logs_read`). Both aggregate log queries and the Management API metrics scrape require this permission. You may also select **Usage Analytics → Read** and **Project Settings → Read** for the monitoring scope discussed in the setup; no write permissions or database access are needed. The current implementation uses Logs Read for its two Supabase requests.
6. Generate the token and copy it once. Keep it out of chat, source control and `.env` files bundled into a frontend.

[Supabase's PAT guide](https://supabase.com/docs/guides/platform/personal-access-tokens) explains project restrictions and permission scopes. The [metrics endpoint](https://supabase.com/docs/reference/api/v1-scrape-project-metrics) accepts this Management API token, so you do not need to share the project's service-role secret.

## 2. Save it in the existing AWS secret

1. Open [AWS Secrets Manager in Mumbai](https://ap-south-1.console.aws.amazon.com/secretsmanager/listsecrets?region=ap-south-1).
2. Select the existing secret whose name starts with **IntegrationsE6599F67**. Verify that it belongs to the TwilightControl stack.
3. Choose **Retrieve secret value → Edit → Plaintext**.
4. Preserve the existing JSON fields, especially `githubToken` (or the GitHub App fields) and any deploy hook. Add one property:

   ```json
   "supabaseAccessToken": "YOUR_NEW_SUPABASE_FINE_GRAINED_TOKEN"
   ```

   For example, when the secret contains a GitHub PAT:

   ```json
   {
     "githubToken": "YOUR_EXISTING_GITHUB_TOKEN",
     "supabaseAccessToken": "YOUR_NEW_SUPABASE_FINE_GRAINED_TOKEN"
   }
   ```

   These are placeholders, not credentials to use. Ensure there is a comma between properties, no trailing comma, and keep any other existing properties.

5. Save. Do not create a second integration secret. Lambda already has read permission to this secret.
6. Wait about **one minute**, reopen **Metrics**, and click Refresh. Secret caching lasts 60 seconds. Changing the secret automatically selects a new server-side report cache key.
7. The two Supabase panels should change to **Connected** with collected timestamps. If one is unavailable, check project access, expiry and Logs Read permission. A paused/unhealthy project or provider outage can also make metrics unavailable. Do not broaden the token to database admin access to solve this.

## 3. Optional provider connections

Add these properties to the **same** secret, preserving all existing values. A deploy hook or TURN credential cannot substitute for an analytics token.

| Properties | Setup |
|---|---|
| `vercelToken`, `vercelTeamId` | Generate an expiring [Vercel access token](https://vercel.com/account/settings/tokens) restricted to the intended team; copy its `team_...` ID from team settings. The token holder needs billing access supported by the team's role/plan. Do not enable a paid plan solely to remove a dashboard warning. The backend reads `/v1/billing/charges` in FOCUS JSONL format. |
| `githubBillingToken` | Optional **separate** fine-grained GitHub PAT with **account Plan: Read** for the repository owner. Keep the build token restricted to Actions read/write and Contents read; it does not need billing or source write permissions. If GitHub does not offer this scope/endpoint for the account, use its Billing console. |
| `cloudflareAnalyticsToken`, `cloudflareAccountId`, `cloudflareTurnKeyId` | In Cloudflare → My Profile → API Tokens, create a custom token with **Account → Account Analytics → Read**, restricted to the calling account. Copy the account ID and existing Realtime TURN key ID. No DNS or account write permission is needed. This token is separate from the TURN credential-generation token used by calls. |

Vercel's [billing API announcement](https://vercel.com/changelog/access-billing-usage-cost-data-api), [GitHub billing usage reference](https://docs.github.com/en/rest/billing/usage), and [Cloudflare TURN analytics schema](https://developers.cloudflare.com/realtime/turn/analytics/) describe the provider data. Their dashboards remain authoritative for allowances and final invoices.

## 4. AWS billing access

The CDK update gives the **Lambda runtime role** only the additional read actions `ce:GetCostAndUsage` and `lambda:GetAccountSettings`. AWS requires account-scoped `Resource: *` for these APIs; this does not grant deployment, payment, or user-record access. CloudWatch reads were already enabled.

If the AWS cost panel is unavailable, open Billing → Cost Explorer with your own account administrator and check whether Cost Explorer is enabled/available for this account. Initial billing data can take time. The dashboard never upgrades an AWS account plan or joins Organizations.

Cost Explorer calls can incur charges. Reports are cached **six hours** in DynamoDB, shared across Lambda instances, with a conditional refresh lease. Successful operational reports cache **five minutes**. Metrics polls once per minute only while the page is visible. API responses remain `no-store` in the browser. The normal summary/CloudWatch chart has a separate 60-second execution-environment cache. A manual Refresh uses these caches; it does not force a paid billing query.

The $10 AWS budget alert remains a warning, not a hard spending limit. Check [AWS Billing → Credits](https://console.aws.amazon.com/billing/home#/credits) for the actual remaining $200 credit balance and expiry.

## 5. Verification and troubleshooting

- **Setup needed:** the required secret properties are missing. This is not zero usage.
- **Unavailable / HTTP 401 or 403:** expired token, wrong project/team/account, insufficient read scope or provider plan restriction.
- **Partial data:** some telemetry is missing/incomplete, or the provider has no supported billing/allowance API configured here. Read the panel's scope text.
- **No samples published:** CloudWatch has not provided samples in the selected period. Other AWS workloads are not included in the admin-stack panels.
- **Counts differ from invoices:** logs and Prometheus counters measure requests/executions/statistics; billing can exclude included usage, aggregate differently and arrive later.
- **New secret not reflected:** allow the 60-second secret cache to expire, then refresh. Unchanged successful data retains its documented five-minute/six-hour cache.
- **Unexpected delays:** external HTTP requests and AWS runtime reads have eight-second deadlines, billing pagination has a shared twelve-second deadline, and provider failures remain isolated. The complete Lambda request is bounded by its 25-second timeout.

Provider reports contain fixed numeric readings and status messages. No raw Supabase logs, SQL text, health records, profiles, chat content, tokens or request bodies are returned to the browser. The raw monitoring PAT has read access to logs at Supabase; restrict its project and protect the AWS secret accordingly. Revocation/rotation happens in the provider console and AWS Secrets Manager.
