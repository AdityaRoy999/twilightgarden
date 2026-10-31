# Twilight Control

A separate, minimal operations dashboard for Twilight Garden. Charcoal surfaces, orange accents, local Solar icons, accessible controls, responsive layouts, and reduced-motion-aware springs. It does not import the consumer app's authentication or read its database.

## Try it locally

From PowerShell, at the repository root:

```powershell
Set-Location '.\admin dashboard'
npm ci
npm run dev
```

Open **http://127.0.0.1:3100/**. Localhost defaults to an explicitly labelled, interactive **demo**. Builds, cancellation, deployment requests, preferences, filtering, run details, and audit exports can be explored without credentials. Demo jobs are illustrative and do not execute or complete a real pipeline. Reloading resets the sample build data.

Production never silently falls back to demo. A missing/invalid `config.json` stops startup. You must deploy and configure AWS before live operations work.

## Included

| Page | Behavior |
|---|---|
| Overview | Workflow activity, success rate, execution duration, pipelines, and console traffic |
| Builds | APK/IPA/DMG workflow dispatch, search, status filtering, job steps, cancellation, artifact ZIP downloads |
| Releases | Server-side multi-platform builds, version/release notes, automatic draft/public GitHub release, optional Vercel deploy hook |
| Metrics | CloudWatch measurements for this dashboard's Lambda, hourly over 24 completed hours |
| Activity | Persistent admin audit events and JSON export |
| Settings | Integration status, pause/resume new build requests, animation preference |

## Deploy and learn AWS

Follow **[DEPLOY.md](DEPLOY.md)** from beginning to end. It explains what each service does, gives PowerShell commands, and includes validation, troubleshooting, updates, cost controls, and teardown. **[ARCHITECTURE.md](ARCHITECTURE.md)** documents trust boundaries and the API.

```powershell
npm run check
npm run infra:synth
```

Infrastructure is TypeScript AWS CDK. No cloud resources are created by `dev`, `build`, `test`, or `infra:synth` (CDK can consult AWS for environment information if an AWS profile is available). Deployment is a separate manual step.

**Automated shipping:** [RELEASES.md](RELEASES.md) explains the one-click server build/release flow, merging the workflow files into main, release notes, checksums, and signing requirements. The browser requests the job; GitHub's servers keep building even after you close it.

**Dependency review:** [SECURITY.md](SECURITY.md) records a known moderate advisory bundled inside the current AWS CDK development tooling. `npm run audit:security` reports that exception and blocks additional moderate/high/critical findings; it does not claim a clean full audit.

## Repository structure

```text
admin dashboard/
  src/                 React dashboard, Cognito PKCE, demo adapter, HTTP client
  src/styles/          Shared design tokens and reference gradients
  shared/              API types
  backend/             Lambda routes, GitHub App/PAT integration, durable dispatches
  infra/               S3, CloudFront OAC, Cognito, API Gateway, Lambda, DynamoDB
  scripts/             Publish public frontend config, invite an admin
  tests/               API/security/idempotency/infrastructure tests
  DEPLOY.md            Windows deployment workshop
  ARCHITECTURE.md       Data flow, permissions, limitations
```

This folder uses the repository's reviewed `components/ui/Icons.tsx`, `MotionPortal`, focus-trapping hook, and `lib/motion.ts`. Keep it inside this repository. Install dependencies at the repository root too when working from a fresh checkout (`npm ci` at the root); root TypeScript explicitly excludes this separate project. Solar icons are by [480 Design](https://www.figma.com/@480design), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### Scope and honest limits

- This is an AWS-hosted control plane; existing app hosting remains Vercel/Supabase and APK/IPA/DMG builders run on GitHub Actions servers.
- No user health data, chats, vault keys, plaintext, or Supabase service role credentials are available to this dashboard.
- An accepted request is not a completed build/deployment. GitHub supplies build status; the optional Vercel hook's final outcome is viewed in Vercel.
- No arbitrary shell commands, arbitrary branches, secret editing, Git pushes, or user-data deletion from the UI. Reviewed code changes still use Git.
- APKs are debug builds; IPAs are unsigned; DMGs are Apple Silicon ad-hoc signed test builds without notarization. Android production signing and Apple distribution remain separate. A free Apple ID still needs Sideloadly signing/refresh.
- Artifacts remain in GitHub under the workflows' existing retention. Downloads are authenticated, temporary GitHub ZIP URLs. There is no pretend S3 artifact archive.
- “Pause new builds” blocks new requests through this console, not direct GitHub actions, already-running jobs, or AWS billing.
- API metrics describe the admin Lambda, not consumer app usage, database latency, or monthly spend. The audit page reads the latest 100 events; TTL retention is 90 days and expiry is asynchronous.
