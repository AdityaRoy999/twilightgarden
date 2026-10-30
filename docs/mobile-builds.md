# Mobile testing builds and automation

Build the current reviewed commit from the GitHub Actions page, or with GitHub CLI:

```powershell
gh workflow run ios-unsigned.yml --ref main
gh workflow run android-apk.yml --ref main
gh run list --limit 10
gh run download RUN_ID --name TwilightGarden-unsigned-iOS --dir output/ios/latest
gh run download RUN_ID --name TwilightGarden-Android-APK --dir output/android/latest
```

The IPA is unsigned: sign/install it using Sideloadly. Free Apple IDs require periodic refresh. The APK is a debug-signed testing build: permit installation from your browser/file manager. A runner-generated debug signing key can differ between builds; uninstall an older test APK if Android reports a signature conflict (uninstalling removes local device keys, so save your account backup password first). Production updates require a stable protected signing key and a release build. No signing credentials or admin secrets are embedded in the web bundle.

Each build embeds its source commit and workflow run in `build-info.json` and includes SHA-256 checksums. Workflows are manual, concurrency-limited and retain artifacts for seven days. They do not auto-publish an app-store release or reset user data.

## Separate admin control panel

A separate authenticated admin dashboard can dispatch these workflows through a server-side GitHub App, list build status/artifacts/source commits, display test results and app metrics, and promote a tested web deployment. Use least-privilege Actions permissions, protected branches/environments, short-lived download links and an audit trail. The dashboard should contain no private user records, messages or encryption keys. Store service credentials only on its backend.

Web changes can deploy automatically. Installed native apps need a new signed package for native changes. A compatible signed web-asset update system can be added later with staged rollout, rollback and platform-policy checks; it must never distribute arbitrary native code or bypass store requirements. An iPhone app signed with a free Apple ID cannot silently renew its signing certificate through this dashboard.
