# Implementation verification

## 6 November 2026 update

- Frontend build and backend/infrastructure types passed. **50 tests in 9 files** passed, including provider isolation, missing credentials, redaction, billing normalization, UTC timestamps, monitoring route authorization and the cross-instance cache lease.
- Collapsible desktop navigation and the mobile drawer were inspected in the browser. At 1280×720 the account/settings footer is visible; at 390×844 content fits without document horizontal overflow. Mobile focus trapping, Escape dismissal and content inertness were checked. The screenshot proof is a labelled local demo, not a live billing screenshot.
- CDK diff contained only the Lambda code/environment and the two read actions `ce:GetCostAndUsage` and `lambda:GetAccountSettings`. Deployed successfully to the existing TwilightControl stack, preserving its budget/SNS subscription, Cognito configuration and data stores. Published the updated frontend to the existing CloudFront site.
- Privileged **direct Lambda invocations**, using a synthetic admin event from the deployment operator, returned HTTP 200 for `/snapshot`, `/metrics` and `/monitoring`. This verifies the deployed handler and provider integrations; it is not a substitute for signing into Cognito and dispatching a build through the browser.
- The live snapshot returned **62 actual GitHub runs and one release**. The old GitHub placeholder has been replaced by the owner. No new native build/release was triggered in this verification; the owner plans to test the console's build button.
- AWS monitoring returned real CloudWatch infrastructure measurements and actual account quotas. Cost Explorer returned real month-to-date charges and applied credits. Repeated monitoring reads reused collected timestamps from the persistent cache. The unauthenticated public `/monitoring` endpoint returned **401**.
- Supabase, Vercel, GitHub billing and Cloudflare analytics tokens were absent at verification. Their panels correctly return **Setup needed**. Supabase's aggregate ClickHouse query was separately verified against live project logs through the connected read-only tool. The Management API PAT path still needs the owner's token setup in [MONITORING.md](MONITORING.md).
- Supabase plan allowances and AI-provider spend remain explicit linked limitations, not fabricated live measurements. Provider windows/scopes are displayed separately and there is no misleading cross-provider cost total.
- The root consumer call regression suite passed **32 tests in 5 files**. An isolated synthetic-account live check verified linked-user TURN credential access, anonymous/unrelated-user rejection, consent denial as 403, and private Realtime channel authorization. Synthetic fixtures were cleaned up.
- A browser fixture carried generated video through two real local RTCPeerConnections; both video elements advanced. Minimize/expand and hangup/media-view removal were checked. This does not certify physical microphone/camera quality or native background screen capture. Installed iPhone background screen sharing and closed-app ringing still require the native integrations documented in `docs/call-studio.md`.
- `npm run audit:security` still reports the previously documented, path-scoped CDK/minimatch moderate advisory and no additional unacknowledged moderate/high/critical finding.

## Initial implementation record

Completed locally on 31 October 2026:

- Frontend TypeScript check and production Vite build passed.
- Backend/infrastructure TypeScript check passed.
- 39 tests across 7 files passed: admin claims, scope/group checks, request validation, main/workflow restrictions, artifact URL/expiry rules, durable duplicate claims, pause transactions, release validation, release dispatch data, isolated Android/iOS version stamping, and synthesized AWS security properties.
- CDK synthesis completed without provisioning AWS resources. The backend bundle is approximately 1 MB.
- Workflow YAML parsed successfully for Android, iOS, DMG, native release, and admin verification.
- Release/version scripts passed Node syntax checks.
- Root consumer-app TypeScript check and `verify:ui` passed; no consumer UI components were changed.
- Repository secret check and staged whitespace checks passed.
- Initial dashboard desktop (1440 px) and phone (390 px) browser checks covered layout, navigation, build dialog, a demo dispatch, run details, cancellation, pause disabling the build button, and no horizontal page overflow. The browser connector became unavailable after the session tooling restarted, so the later release-composer extension was checked through compilation and tests; its live acceptance steps remain in RELEASES.md.

Bundle output is split into application, React, and motion chunks; combined JavaScript is approximately 171 KB gzip. No external icon requests, fonts, or analytics are loaded.

`npm run audit:security` reports the exact known moderate CDK bundled-dependency exception in SECURITY.md and rejects other moderate/high/critical findings. A plain full `npm audit` is **not clean** because AWS's current CDK release bundles the affected minimatch version.

## Server build and release acceptance

- GitHub macOS run [41216997119](https://github.com/AdityaRoy999/twilightgarden/actions/runs/41216997119) built the Apple Silicon ad-hoc DMG successfully in approximately 7 minutes. The downloaded DMG checksum matched the workflow checksum file.
- Native release run [41218151148](https://github.com/AdityaRoy999/twilightgarden/actions/runs/41218151148) built Android version 0.0.4 and successfully created an unpublished draft release with the debug APK, source manifest, SHA-256 checksums, and supplied release notes. Validation, the selected build, and the publishing job all passed. Source commit: `76288450bec6b0b370f852943fc2484f62ff1fa4`.
- The draft is intentionally retained for the repository owner to review. No public release was published. These tests were dispatched using the authenticated GitHub CLI, not the undeployed AWS dashboard API.
- The downloaded APK matched `SHA256SUMS.txt`: `e5d00dfdbe5fef76e07f85bf5477eeeeeef9d096b7ec96b39268f5dfe5d17dc9`.

## Initial acceptance limitations (superseded where noted above)

No AWS account resources, Cognito users, or integration secrets were created during implementation. AWS credentials, service availability/quotas, Cognito delivery/MFA, dispatches through the deployed API, and explicit public release publication require the live deployment/acceptance steps. The iOS workflow was checked but was not rerun in this admin-dashboard acceptance test. An unsigned IPA, debug APK, and ad-hoc DMG are test distribution; the pipeline does not establish production app signing, notarization, or silent installed-app updates.

The default local preview uses labelled sample data and never submits a real build or publishes a real release.
