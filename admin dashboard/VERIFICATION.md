# Implementation verification

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

## Not yet established

No AWS account resources, Cognito users, or integration secrets were created during implementation. AWS credentials, service availability/quotas, Cognito delivery/MFA, dispatches through the deployed API, and explicit public release publication require the live deployment/acceptance steps. The iOS workflow was checked but was not rerun in this admin-dashboard acceptance test. An unsigned IPA, debug APK, and ad-hoc DMG are test distribution; the pipeline does not establish production app signing, notarization, or silent installed-app updates.

The default local preview uses labelled sample data and never submits a real build or publishes a real release.
