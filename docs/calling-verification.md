# Native calling and chat details — verification

Updated 7 November 2026. This is an implementation and test record, not a claim
that every phone/OS combination has passed physical-device testing.

## Implemented

- Optional, self-hosted LiveKit media transport. P2P remains the default until
  the Supabase `LIVEKIT_*` server secrets are configured. A failed SFU encryption
  check does not silently fall back to unencrypted SFU media.
- Native Android MediaProjection and iOS 27 ScreenCaptureKit sharing. Device
  audio is opt-in; microphone mute is independent. Capture is owned by the native
  SDK instead of the WebView. Android has an ongoing microphone foreground
  service notification. Remote departure stops native capture even when JS is
  suspended. Late screen-picker results cannot attach to a different call.
- A draggable preview, edge docking/restoration and one app size toggle. The
  call controls follow light/dark themes, spring and reduced-motion preferences.
- Native picture-in-picture integration uses an iOS sample-buffer video-call
  surface and Android activity PiP. The button is capability gated; actual
  background playback and restoration still require device verification.
- Desktop remote input, requiring the installed Tauri app, full primary-display
  sharing, an in-app review and a separate native consent dialog. The session
  lasts at most five minutes; stopping sharing, revoking, unlinking or ending
  the call ends access. The limited input vocabulary supports pointer movement,
  clicks, scrolling, ordinary text and navigation keys. It provides no shell,
  clipboard, modifier shortcuts, unattended access or phone OS control.
- Owner-encrypted call history with direction, voice/video, local date/time,
  duration and outcome. No call recording. A linked partner cannot read these
  private rows. Unlinking purges relationship-scoped history and chat themes.
- A chat-details sheet with loaded media, links, starred messages, loaded-history
  search, older-message loading, call history/callbacks, encrypted chat themes,
  profile/photo editing and links to existing privacy/notification settings.
  Document-message upload and storage management are not added in this change.

## Automated checks

| Check | Result |
| --- | --- |
| TypeScript and production web bundle | Passed |
| Full Vitest suite | 392 tests across 84 files passed, followed by focused checks for the native PiP UI |
| Two separate browser clients through real local LiveKit | Both decoded encrypted video and non-silent audio |
| Different media keys | Encryption error; neither client decoded video |
| Actual CallStudio at 390×844 and 1440×900 | Controls fit, preview hides/restores, device-audio toggle works |
| Chat-details component flows | Search, deleted-message exclusion, history, callback, theme persistence, errors and carer settings passed |
| Existing live Supabase call smoke | TURN endpoint and private signaling membership checks passed |
| Live Supabase synthetic-account test | Owner decryption, partner denial, overwrite denial, scoped endpoint auth and unlink purge passed |
| Edge Functions Deno check | Passed, including `call-room` and cleanup consumers |
| Native Android Kotlin compile | Passed against API 36 |
| Desktop Rust check | Passed |
| Native iOS compile | Passed on GitHub's Xcode 27.1 runner; no IPA created |
| Theme/UI verification script | Passed |

The SFU browser tests use synthetic camera/microphone sources and loopback
networking. They do not measure cellular quality or prove native/browser E2EE
interoperability. Native libraries compile; cross-platform media still needs a
real iPhone/Android call.

## Required device and server checks

1. Deploy the TLS-enabled self-hosted service using
   [the setup guide](../infra/calls/README.md), then set the three Supabase Edge
   secrets. No paid AWS resources were provisioned for this work.
2. Install a build containing `@twilight/native-calls`. Existing installed apps
   cannot gain this plugin from a web-only update.
3. Confirm iPhone signing retains the screen-recording entitlement. Free Apple
   ID signing is not proven by an unsigned compile. Earlier iOS versions need a
   ReplayKit broadcast extension, which is not included here.
4. Test iOS↔Android, native↔browser, and desktop↔phone on different networks.
   Check camera/mic denial, picker cancellation, sharing with/without device
   audio, mic mute during shared audio, app switching, rotation, device lock,
   network handoff and ending/unlinking from the other device while backgrounded.
5. Verify the transmitted screen/audio from the receiving device. DRM/private
   apps can intentionally suppress capture. Force-quitting is not backgrounding.
6. Test desktop input on a consented primary display, including letterboxing,
   revocation, timeout, remote hangup and OS accessibility permissions.

Browser picture-in-picture remains available where supported. Native cross-app
PiP is implemented but not physically verified. Incoming-call ringing with the
app terminated, background camera video on every OS, and native beauty/background
filters are not established by this implementation. The existing browser effects are available on P2P calls;
native SFU calls do not claim those filters. An SFU also does not create extra
bandwidth or guarantee a sharper two-person call than a good direct connection.

## Reproduce locally

```powershell
npm ci
docker compose -f infra/calls/compose.yaml up -d
npm run dev:local
# In another terminal:
$env:TEST_LOCAL_SFU = '1'
npx playwright test tests/e2e/call-features.spec.ts --reporter=line
npm test
npm run build
npm run verify:ui
```

The local SFU listens only on loopback and uses public development credentials.
Do not expose that development configuration to the internet.
