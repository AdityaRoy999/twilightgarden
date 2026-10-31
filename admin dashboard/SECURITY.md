# Security notes

## Known upstream deployment-tool advisory

At implementation time, `aws-cdk-lib@2.275.0` (the latest available registry version) bundles `minimatch@10.2.6`. npm reports **GHSA-g3hv-75wg-m249**, a moderate glob-parts amplification denial-of-service advisory affecting minimatch before 11.0.1. npm also reports `aws-cdk-lib` through that dependency. npm cannot replace bundled dependencies using a normal override; no upstream CDK update is currently available.

CDK is a local/CI development dependency, not imported into the browser or Lambda handler. This project does not submit remote admin input as CDK glob patterns. This limits the exposure in this implementation; it does not mean the dependency is fixed. Do not synthesize arbitrary untrusted infrastructure or untrusted glob configurations with this toolchain.

`npm run audit:security` reports this exact, path-scoped upstream exception and fails for other moderate/high/critical findings. It deliberately does **not** report a clean full audit. `npm audit` remains available and exits nonzero while this upstream issue exists. The exception should be removed as soon as AWS ships a CDK version with a fixed bundled minimatch; update the lockfile and rerun synthesis/tests. Do not use `npm audit fix --force` or modify the bundled package silently.

Advisory: https://github.com/advisories/GHSA-g3hv-75wg-m249

## Deployment validation

Automated tests validate authentication checks, restricted workflow dispatch, duplicate suppression, pause transactions, artifact URL restrictions, and synthesized AWS configuration. They use mocked provider responses and CloudFormation assertions. They cannot establish that your future account permissions, Cognito emails/MFA, GitHub credentials/allowance, or AWS quotas are configured correctly. Complete the live acceptance steps in DEPLOY.md after deployment.

No AWS infrastructure has been deployed by the implementation task. Do not claim the live AWS deployment is verified until the acceptance steps have actually passed.

## Sensitive data

- No Supabase service role, private user content, chat decryption, or vault key access.
- GitHub credentials and deploy hooks only in Secrets Manager.
- Public frontend config only includes API/Cognito endpoints, client ID, region.
- Access tokens in session storage, not persisted across tabs/browser sessions by the application.
- Audit records contain opaque admin identifiers and operational actions; restrict/export them intentionally.
- CloudFront's default-domain TLS policy is AWS-managed; use a custom ACM certificate/domain if a specific minimum TLS policy is required.
