# Deploy Twilight Control on AWS — a Windows learning workshop

This guide deploys **only the separate admin dashboard**. Your consumer app stays on Vercel/Supabase, and your existing GitHub workflows build the IPA/APK. Read each checkpoint before continuing. Nothing in this guide requires putting AWS keys, GitHub tokens, Apple credentials, or deploy hooks in the frontend.

## 1. Understand what you will create

| Service | Your learning goal | Why it is here |
|---|---|---|
| CloudFormation / CDK | Infrastructure as code, diffs, rollback | Repeatably create the entire stack |
| S3 | Private object storage | Store static dashboard HTML/JS/CSS |
| CloudFront + OAC | HTTPS, CDN, private origins | Serve S3 content without making the bucket public |
| Cognito | Authentication, MFA, OAuth PKCE | Invite-only admin login |
| API Gateway HTTP API | JWT authorizers, CORS, throttling | Authenticate requests before Lambda |
| Lambda | Roles, ARM runtime, concurrency | Run the admin API only when requested |
| DynamoDB | Keys, on-demand capacity, transactions, TTL | Audit history, settings, duplicate build protection |
| Secrets Manager | Server-side credentials | GitHub integration, optional Vercel deploy hook |
| CloudWatch | Logs, metrics, alarms | Observe the backend |
| Budgets / SNS | Cost alerts, notification confirmation | Warn about gross account spend and Lambda errors |

The architecture is in [ARCHITECTURE.md](ARCHITECTURE.md). Choose **Mumbai, `ap-south-1`**, for regional resources. CloudFront is global.

## 2. Prepare your AWS account

1. Sign into your AWS account yourself. Enable MFA on the root user and keep root for account-only tasks.
2. Open Billing → Credits and Free Tier. Check the balance, expiry, account plan, and available services. Credits do not make every service free; avoid upgrading your plan without understanding the billing change.
3. Create a dedicated IAM deployment user with console access and MFA, or use an existing authorized federated deployment role. Do not create an access key. Attach AWS's `SignInLocalDevelopmentAccess` policy so that this identity can use browser-based CLI login.
4. Grant that identity deployment permissions for CloudFormation/CDK bootstrap, IAM role creation/pass-role, and the services in step 1. In your own isolated learning account, a temporary AdministratorAccess deployment identity is the simplest bootstrap path, but it is broad: use it only for deployment, never for the dashboard runtime. In a shared account, the owner should provide a scoped role and permissions boundary.
5. **Keep your free-plan account out of AWS Organizations/Control Tower for this workshop.** Creating/joining an organization can upgrade the plan and invalidate Free Tier credits. This dashboard does not need Organizations or a new IAM Identity Center organization instance. If you already use an organization/Identity Center account, use its existing approved SSO profile instead of creating another organization.

Learn: [browser-based AWS CLI login](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html), [Free Tier terms](https://aws.amazon.com/free/terms/).

## 3. Install local tools

Install Node.js **22.12+** (Node 22 LTS is suitable), Git, and AWS CLI v2 from their official installers. Reopen PowerShell after installation.

```powershell
node --version
npm --version
git --version
aws --version
```

Use AWS CLI v2, not the old Python v1 package. An AWS account and a Cognito dashboard account are separate identities: your CLI identity deploys infrastructure; Cognito authenticates the admin website.

## 4. Sign into AWS from PowerShell

Use AWS CLI **v2.32.0 or newer**, which supports browser-based login. Sign in with the dedicated deployment identity from step 2, not root:

```powershell
aws login --profile twilight-admin
$env:AWS_PROFILE = 'twilight-admin'
$env:AWS_REGION = 'ap-south-1'
$env:AWS_DEFAULT_REGION = 'ap-south-1'
aws sts get-caller-identity
```

Choose Mumbai when prompted for a deployment region. Finish MFA in your own browser. Verify the displayed account/identity is the intended account. Temporary sessions expire; repeat `aws login --profile twilight-admin` when needed. Do not paste credentials into the repo or chat.

If CDK cannot read the new login profile, use AWS's compatibility bridge:

```powershell
aws configure set credential_process 'aws configure export-credentials --profile twilight-admin --format process' --profile twilight-cdk
aws configure set region ap-south-1 --profile twilight-cdk
$env:AWS_PROFILE = 'twilight-cdk'
aws sts get-caller-identity
```

The bridge fetches temporary credentials without embedding permanent keys. Keep `twilight-admin` as the sign-in source and `twilight-cdk` as the process profile; pointing the process back to itself creates a loop.

**Existing SSO users only:** if you already have an approved Identity Center setup, `aws configure sso --profile twilight-admin` and `aws sso login --profile twilight-admin` remain valid. Do not enable a new organization just to follow that route.

## 5. Install and explore the dashboard locally

At your existing Twilight repository root:

```powershell
npm ci
Set-Location '.\admin dashboard'
npm ci
npm run dev
```

Visit **http://127.0.0.1:3100/**. Try Overview, Builds, run details, filters, Activity, and Settings. The banner explicitly says demo. No real jobs are triggered. Press Ctrl+C in that terminal when done, or use a second PowerShell terminal for deployment. Keep running deployment commands from `admin dashboard`.

```powershell
npm run check
```

**Checkpoint:** frontend build, backend/infrastructure types, and all tests pass.

## 6. Bootstrap CDK once

```powershell
$accountId = aws sts get-caller-identity --query Account --output text
npx cdk bootstrap "aws://$accountId/ap-south-1"
```

This creates a separate `CDKToolkit` CloudFormation stack with a private asset bucket and deployment roles. Review the IAM changes before accepting. The standard bootstrap execution role is powerful; this is why you use a dedicated deployment identity. Bootstrapping is once per account/region, not once per app.

Learn: [what CDK bootstrapping creates](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html).

## 7. Review the generated infrastructure

```powershell
npm run infra:synth
npx cdk diff -c alertEmail=YOUR_EMAIL_ADDRESS
```

Replace `YOUR_EMAIL_ADDRESS` with an inbox you control. The email becomes a CloudFormation parameter/context value and alert recipient, not a secret. It is used only for this deployment, not invented from another user's data.

Open `cdk.out/TwilightControl.template.json`. Find:

- S3 public-access blocking and CloudFront origin access control.
- Cognito self-signup disabled, MFA required, public app client with **code** flow.
- API JWT authorizer and `twilight-admin/control` scope.
- Lambda IAM permissions and bounded concurrency.
- DynamoDB on-demand capacity, transaction permissions, and TTL.
- `$10` monthly account-wide gross spending budget (credits/refunds excluded), with email alerts at 50% and 100%.

This is a **notification budget**, not an enforced spend cap. AWS billing data and alerts are delayed. [AWS explanation](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).

## 8. Deploy the stack

```powershell
npm run infra:deploy -- -c alertEmail=YOUR_EMAIL_ADDRESS
```

Review the IAM changes, then approve in your terminal. CloudFront distribution creation can take several minutes. Keep `alertEmail` the same on subsequent deploys; omitting it removes the optional budget/alarm email resources from the next template.

The command creates **`deployment.local.json`** (gitignored) containing resource names and public endpoint configuration. It contains no secret values. Keep this file for publishing and invitations.

If your new account cannot reserve two Lambda executions because of its regional concurrency quota, use:

```powershell
npm run infra:deploy -- -c alertEmail=YOUR_EMAIL_ADDRESS -c reservedConcurrency=0
```

This leaves Lambda concurrency unreserved; API Gateway still throttles traffic, but it is not a hard concurrency or spending cap. Use the same context on future deploys. Alternatively, request a suitable Lambda concurrency quota and keep the default reserved limit of 2.

**Checkpoint:** CloudFormation → `TwilightControl` → status `CREATE_COMPLETE`. Confirm the SNS subscription email so error alarms can reach you. Budget messages use their own AWS email delivery.

## 9. Connect GitHub — choose one approach

The dashboard expects the existing repository `AdityaRoy999/twilightgarden`, branch `main`, and these committed workflows:

- `.github/workflows/ios-unsigned.yml`
- `.github/workflows/android-apk.yml`
- `.github/workflows/macos-dmg.yml`
- `.github/workflows/native-release.yml`

Merge the new workflows, reusable-workflow changes, and release scripts into **main** before live use. See [RELEASES.md](RELEASES.md) for the complete automated build/ship flow and required GitHub job permissions. Changes still only on your PC or a feature branch cannot be built by a main-branch server job.

Existing GitHub repository variables required by those workflows must remain configured, including `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Keep secret build inputs in GitHub secrets; only intentionally public `VITE_` values belong in bundled apps. Builds consume your GitHub Actions allowance independently of AWS credits.

### Option A — expiring fine-grained PAT (simplest first deployment)

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens.
2. Create a token with a short expiry, the correct resource owner, and **only this repository** selected.
3. Grant repository **Actions: read and write**, **Contents: read**. Metadata read is included. Do not grant account administration or repository contents write.
4. Copy the token privately.
5. AWS Console → Secrets Manager → the secret named by `SecretArn` in `deployment.local.json` → Retrieve secret value → Edit → Plaintext.
6. Replace the placeholder with valid JSON:

```json
{"githubToken":"PASTE_THE_TOKEN_PRIVATELY_IN_AWS"}
```

Save in AWS, not in a tracked file. Wait up to one minute for the Lambda secret cache. Record the token expiry for rotation.

### Option B — GitHub App (better for longer-term operation)

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
2. Choose a name unique to you. Homepage can be your new `SiteUrl`. Webhooks are **not required**; disable Active under Webhook.
3. Repository permissions: **Actions read/write**, **Contents read**, Metadata read. Install only on this account/repository.
4. Generate a private key and download it privately. Note App ID and installation ID (the installation settings URL contains the installation ID).
5. In Secrets Manager plaintext, save:

```json
{
  "appId":"YOUR_APP_ID",
  "installationId":"YOUR_INSTALLATION_ID",
  "privateKey":"YOUR_PEM_PRIVATE_KEY_WITH_ESCAPED_NEWLINES"
}
```

JSON requires newline escapes (`\n`) inside the string. Use a trusted local editor to prepare the JSON if needed, keep it outside Git, and enter it yourself into AWS. Remove the placeholder `githubToken` field when using App credentials. The code prioritizes a configured PAT otherwise.

Learn: [GitHub workflow API and permissions](https://docs.github.com/en/rest/actions/workflows).

## 10. Optionally enable production deployment

Skip this if you want only build controls.

1. In your existing Twilight Vercel project → Settings → Git → Deploy Hooks, create a hook for **main**, named `Twilight Control`.
2. Add `vercelDeployHook` to the same Secrets Manager JSON, preserving your GitHub fields:

```json
{
  "githubToken":"YOUR_EXISTING_TOKEN",
  "vercelDeployHook":"YOUR_PRIVATE_VERCEL_MAIN_DEPLOY_HOOK"
}
```

The hook is a credential: anyone who has it can trigger the configured deployment. Never put it in public `config.json`, browser environment variables, a README, or a chat. The dashboard validates Vercel's HTTPS API hostname/path. Confirm the hook is actually tied to main; the backend cannot inspect the branch encoded in an opaque hook.

Learn: [Vercel deploy hooks](https://vercel.com/docs/deploy-hooks).

## 11. Publish the frontend

```powershell
npm run build
npm run site:publish
```

The publishing script reads your local stack outputs, generates public `config.json`, uploads hashed assets with immutable caching, uploads HTML/config with no-store caching, then invalidates only the entry/config paths in CloudFront. It never copies `.env` or integration credentials. Old hashed assets are preserved so existing tabs keep working.

Open the printed `SiteUrl`. CloudFront propagation/invalidation can take a few minutes. The page should show **Sign in securely**, not the local demo banner. The S3 website endpoint is intentionally inaccessible; use CloudFront.

## 12. Invite yourself as an admin

```powershell
npm run admin:invite -- YOUR_ADMIN_EMAIL
```

AWS sends a temporary password to that inbox, and the script adds the account to the Cognito `admins` group. Only run this for an inbox you control. It does not print the password.

Open the dashboard → Sign in securely → use the emailed temporary password → choose a new strong password → enroll your authenticator app for TOTP MFA. Store recovery information safely. Do these credential steps yourself.

If the user already exists, add it to the group manually instead of recreating it:

```powershell
$stack = (Get-Content '.\deployment.local.json' -Raw | ConvertFrom-Json).TwilightControl
aws cognito-idp admin-add-user-to-group --user-pool-id $stack.UserPoolId --username YOUR_ADMIN_EMAIL --group-name admins --region ap-south-1
```

If an invitation expired, use Cognito's resend-invitation action or `admin-create-user --message-action RESEND` with the existing username. Cognito email quotas apply to the default email service.

**Checkpoint:** completing MFA redirects to CloudFront and displays live operational data. An ordinary authenticated user without `admins` must still receive 403 from the backend.

## 13. Test the live system end to end

1. Overview shows your actual GitHub runs. Sample numbers are gone.
2. Choose **New build → Android → Build Android**. A request event appears in Activity and the real workflow appears in Builds. Allow one polling interval (15 seconds) plus provider queue time.
3. Open the queued/running build. Inspect steps, open full logs on GitHub, and wait for success.
4. Download **ZIP**, extract it, and check `SHA256SUMS.txt` against the APK. On Windows: `Get-FileHash .\TwilightGarden-test.apk -Algorithm SHA256`.
5. Repeat for iOS. The ZIP contains an **unsigned IPA**; sign/install it with Sideloadly. Your free Apple ID's signing limits still apply.
6. Settings → Pause new builds. Confirm the New build control is disabled. Resume. This does not stop direct GitHub dispatches or existing jobs.
7. Start a disposable mobile build and cancel it in run details. Observe the final status on GitHub; cancellation is not instantaneous.
8. Metrics may initially be empty or zero. CloudWatch publishes asynchronously; hourly data uses the last **24 completed hours**. Check after a completed hour. These metrics measure this console's Lambda, not the consumer app.
9. Activity → Export JSON. Check timestamps, opaque Cognito admin identifier, requested/accepted actions, and that no token, signed URL, or private user content appears.
10. If you configured the Vercel hook, review main, then explicitly confirm **Deploy latest main**. Check the final deployment result in Vercel. The console only confirms request acceptance.
11. Sign out, then verify API requests without an access token are rejected. Close/reopen the browser tab to verify session behavior. Access tokens expire after 30 minutes; sign in again when asked.
12. Releases → New release: choose an unused version, notes, and platforms. First leave publishing off and verify a draft release with installers, checksums, and the exact source commit. For the next version, explicitly enable/confirm automatic publication. The workflow ships only after all selected builds succeed. See [RELEASES.md](RELEASES.md).

## 14. Learn by finding each resource in the console

Use `deployment.local.json` and CloudFormation → Resources to find physical names.

- **S3:** public access remains blocked; assets exist; `config.json` contains public endpoints only.
- **CloudFront:** origin uses OAC; HTTPS redirect; response headers; invalidation status.
- **Cognito:** invited users, `admins` group, MFA, app-client callback URL equals your CloudFront URL.
- **API Gateway:** JWT issuer/client, required scope, CORS origin, route throttling.
- **Lambda:** environment variables contain resource names, not integration credentials; role is scoped; ARM runtime; duration/error metrics.
- **DynamoDB:** `SETTINGS` item; `REQUEST#…` duplicate claims; `AUDIT` timestamp items; TTL attribute `ttl`.
- **Secrets Manager:** token stored only here; Lambda read permission is limited to this secret.
- **CloudWatch:** structured request errors; no request bodies or secrets; 30-day retention.
- **Budgets:** account-wide gross spending alerts; check actual remaining credits in Billing separately.

## 15. Update code later

Frontend changes:

```powershell
npm run check
npm run build
npm run site:publish
```

Backend/infrastructure changes:

```powershell
npx cdk diff -c alertEmail=YOUR_EMAIL_ADDRESS
npm run infra:deploy -- -c alertEmail=YOUR_EMAIL_ADDRESS
npm run build
npm run site:publish
```

Preserve any additional deployment context (such as `reservedConcurrency=0`) each time. Review diffs for resource replacement or IAM expansion. Changing Cognito callback origins/custom domains requires corresponding backend CORS/CSP updates; this initial stack uses CloudFront's generated domain only.

Use Git branches/PRs for source changes. The dashboard intentionally has no arbitrary terminal or “push any code” control. Existing workflows compile the latest protected main; merging remains your source-of-truth release step.

## 16. Cost controls, pausing, and shutdown

There is no EC2, RDS, NAT, load balancer, or continuously allocated Mac in this stack. Request-based services can still charge for usage; S3, logs, Secrets Manager, alarms, and retained resources may have ongoing charges. GitHub usage is billed separately. This guide does not promise a monthly amount or a credit lifetime; check your plan, region prices, and measured usage.

**Pause new builds:** Settings → Pause new builds. It blocks only console dispatches. Cancel running builds separately.

**Emergency stop of this admin backend:** from your authenticated deployment terminal:

```powershell
$stack = (Get-Content '.\deployment.local.json' -Raw | ConvertFrom-Json).TwilightControl
aws lambda put-function-concurrency --function-name $stack.FunctionName --reserved-concurrent-executions 0 --region ap-south-1
```

This stops Lambda execution; dashboard API calls fail until restored. It does not stop GitHub jobs, the consumer app, CloudFront requests, or retained storage charges. To restore the default two executions:

```powershell
aws lambda put-function-concurrency --function-name $stack.FunctionName --reserved-concurrent-executions 2 --region ap-south-1
```

If you deployed with unreserved concurrency, restore that instead:

```powershell
aws lambda delete-function-concurrency --function-name $stack.FunctionName --region ap-south-1
```

Record emergency manual changes; CloudFormation drift detection and a deliberate deployment reconcile intended state. Do not call this a zero-cost “nuclear switch.”

**Remove the admin stack when you finish learning:**

```powershell
npx cdk destroy TwilightControl -c alertEmail=YOUR_EMAIL_ADDRESS
```

Read and confirm the removal plan yourself. This removes API/Lambda/CDN and stack-owned alarm/budget resources. The stack intentionally **retains S3 site data, Cognito users, DynamoDB audit/settings, Secrets Manager credentials, and logs**. Retained resources can still cost money and must be inventoried from CloudFormation before deletion. Recreating the stack does not automatically reattach retained resources; use explicit CDK import/adoption or consciously delete them after exporting what you need.

For a complete cleanup, use the AWS console to review/export retained data, then explicitly delete only this project's retained buckets/objects, table (disable its deletion protection first), pool, log group, and secret (use a recovery window). Also inspect CDKToolkit's asset bucket and bootstrap roles; other CDK apps may depend on them. Do not delete shared bootstrap resources blindly. Disabling the dashboard alone cannot reduce unrelated AWS account spending to zero.

## Troubleshooting

| Symptom | Check |
|---|---|
| Deployment permission denied | Correct CLI account/role; session not expired; bootstrap execution permissions |
| Lambda reserved concurrency error | Regional quota; use the documented `reservedConcurrency=0` context or request a quota increase |
| Synthesis module errors | `npm ci` in root **and** `admin dashboard`; supported Node version |
| Site says configuration missing | Correct outputs file; `npm run build` then `site:publish`; CloudFront propagation |
| OAuth redirect mismatch | CloudFront URL exactly matches Cognito callback URL, including trailing `/`; no custom domain yet |
| Login completes but 403 | User in `admins`; sign out/in after group changes; required custom scope present |
| Initial GitHub connection failure | Correct Secrets Manager secret JSON; PAT not expired; Actions write/Contents read; wait 60 seconds |
| Workflow dispatch 404 | Workflows committed to main; integration installed on the correct repository |
| Workflow fails | Open GitHub steps/logs; repository build variables/dependencies; GitHub runner allowance |
| Artifact download expired | GitHub retention elapsed; create a new build |
| Duplicate/uncertain request message | Check GitHub/Vercel first; a timeout may have accepted the previous request |
| Metrics zero | Wait for a completed hour; measure dashboard Lambda, not app sessions; no fabricated fallback |
| 429/503 under rapid clicking | API throttling/concurrency or provider rate limits; wait and refresh |
| Password/MFA issue | Recover/manage only the Cognito admin identity; consumer Supabase accounts are unrelated |

## References

- [Cognito PKCE authorization code flow](https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html)
- [API Gateway JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)
- [CloudFront private S3 access](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [GitHub Actions artifact downloads](https://docs.github.com/en/rest/actions/artifacts)
- [EC2 Mac minimum allocation](https://aws.amazon.com/ec2/instance-types/mac/) — why this dashboard keeps occasional iOS builds on GitHub macOS runners.
