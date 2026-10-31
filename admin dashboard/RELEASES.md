# Automated builds and releases

This is the operating guide for the **Build APK / Build IPA / Build DMG / Build & ship** controls. AWS runs the dashboard and API; GitHub-hosted runners compile the apps. Your Windows PC does not need to stay on after a request is accepted.

## Before the first release

1. Finish [DEPLOY.md](DEPLOY.md): AWS infrastructure, integration secret, frontend publishing, admin invitation, MFA.
2. Commit and merge the new dashboard, scripts, and **all four build/release workflow files** to `main`: `android-apk.yml`, `ios-unsigned.yml`, `macos-dmg.yml`, `native-release.yml`. Workflow dispatch requires the workflow to exist on the default branch. Do not build from uncommitted local changes.
3. In GitHub → repository Settings → Actions → General, allow the workflows to run. The release workflow's final job needs `GITHUB_TOKEN` **Contents write** to create a tag/release and **Actions read** to download its own artifacts. If organization policy forbids this, the owner must approve an appropriate policy before shipping. Build jobs retain Contents read.
4. Keep existing build-time repository variables configured: Supabase URL/anon key, Giphy key if used, legal operator configuration when ready. They are intentionally bundled public app configuration. Do not place private credentials in `VITE_` variables.
5. GitHub App/PAT used by the AWS API still needs **Actions write + Contents read** only. It dispatches the workflow; the workflow's narrowly scoped job token performs publishing. You do not need to give the dashboard arbitrary source-code write access.
6. Check GitHub Actions spending/runner allowance. macOS builds consume GitHub runner minutes independently of AWS credits.

## Just build one installer

Dashboard → **New build** → Android / iOS / macOS → Build. Open **Builds**, select the run, watch steps, and download the artifact ZIP when successful. Direct build artifacts use the workflows' current 7-day retention.

- **Android:** `TwilightGarden-test.apk`, debug-signed. It is installable for testing. Hosted runners can generate different debug signing keys, so replacing an installed debug build may require uninstalling the old app. Uninstalling removes local encryption keys: have your account backup password first. Production Android updates require a stable release signing key and a separate release variant; this pipeline does not pretend to provide production signing.
- **iOS:** `TwilightGarden-unsigned.ipa`. Sign with Sideloadly on Windows using your free Apple ID. A new pipeline cannot bypass Apple signing/expiry requirements.
- **macOS:** Apple Silicon (`aarch64`) `.dmg`, ad-hoc signed, **not notarized**. This is test distribution. The free Apple ID does not supply a Developer ID distribution certificate. Normal macOS Gatekeeper installation warnings can apply. Intel macOS builds are not included in this initial workflow.

## Build and ship with notes

1. Dashboard → **Releases → New release**.
2. Enter a new numeric version, e.g. `0.1.0`. Use a never-used version; the pipeline refuses to overwrite an existing tag. Each component is 0–999, and `0.0.0` is rejected.
3. Select one or more platforms: APK, IPA, DMG.
4. Enter the release notes. Markdown is supported. Notes are data, not shell commands.
5. Choose the outcome:
   - **Default:** leave “Publish when all builds succeed” off. The server builds everything and creates a **draft GitHub release** for review.
   - **Publish:** enable it and explicitly confirm publishing the notes and downloads. When all selected builds succeed, the workflow publishes the release. In a public repository the downloads and notes are public; in a private repository normal repository access rules apply.
6. Click **Build and create draft** or **Build and publish release**. The request is durably recorded and the release workflow runs from the current main commit.
7. In Builds, select the **Releases** filter and open `Native release v…` to see the validation/build/ship jobs. Compilation runs on GitHub's Linux and macOS machines. Your browser can be closed after acceptance.
8. After success, return to Releases → Release history. Published releases appear through the integration; draft visibility depends on GitHub permissions. Use **Review drafts on GitHub** while signed into your owner account to review/publish a draft. To publish automatically from the dashboard in one operation, use the explicit publish option at step 5.

### What the workflow does

```text
Validate version, platform list, notes, main branch, unused tag
                          ↓
             Resolve one workflow source commit
                          ↓
    Android APK   /   unsigned iOS IPA   /   macOS DMG
                          ↓
          Require every selected build to succeed
                          ↓
    Download installers, rename with version/signing status
                          ↓
       SHA256SUMS.txt + build-manifest.json + release notes
                          ↓
                 Draft or published GitHub release
```

Native application version/build numbers are stamped only inside the CI checkout. No workflow commits generated version changes back to main. Both reusable builds and the release publisher use the caller's exact source commit. The manifest records that commit, workflow run, version, platforms, and signing limitations.

An installer build failure prevents shipping. A GitHub publishing error can leave a draft/tag or partially uploaded release; review the actual GitHub state before retrying. Use a new version when a tag already exists. Do not overwrite an existing public release silently. Request UUID protection prevents duplicate dispatches for the same request but cannot promise distributed exactly-once behavior after a provider timeout.

## What “ship” does and does not mean

It creates downloadable GitHub release assets and release notes. It does not publish to App Store/Play Store, install updates silently, notarize macOS, renew a free Apple certificate, or configure the existing Tauri updater endpoint. Signed in-app desktop updates require a protected updater signing key and update-manifest hosting, and macOS trusted distribution requires Apple signing/notarization. Those are separate from producing a DMG. Browser-hosted UI updates continue to use the existing Vercel deployment flow.

## Command equivalents

After the workflows are merged into main, from an authenticated GitHub CLI:

```powershell
gh workflow run android-apk.yml --ref main
gh workflow run ios-unsigned.yml --ref main
gh workflow run macos-dmg.yml --ref main
```

For a complete release, avoid putting multi-line notes into a shell command. Create an ignored local request JSON file using your editor:

```json
{
  "ref":"main",
  "inputs":{
    "version":"0.1.0",
    "platforms":"[\"android\",\"ios\",\"dmg\"]",
    "release_notes":"Your release notes here.\nSecond line.",
    "publish":false
  }
}
```

Save as `release-request.local.json`, then:

```powershell
gh api --method POST repos/AdityaRoy999/twilightgarden/actions/workflows/native-release.yml/dispatches --input .\release-request.local.json
gh run list --workflow native-release.yml --limit 10
gh run watch RUN_ID
```

Delete only your temporary request file when no longer needed. No build or release is run by the local development demo.

References: [GitHub reusable workflows](https://docs.github.com/en/actions/concepts/workflows-and-actions/reusing-workflow-configurations), [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/).
