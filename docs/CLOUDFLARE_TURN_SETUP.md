# Cloudflare TURN setup

Twilight now asks its authenticated Supabase `call-credentials` function for expiring
Cloudflare ICE credentials. The Cloudflare API token stays on the backend. The function
checks active relationship membership and limits credential requests to 30 per user per
UTC clock hour. Credentials default to one hour and refresh during longer calls.

## Create the credentials

1. Open the [Cloudflare Realtime dashboard](https://dash.cloudflare.com/?to=/:account/calls)
   in your Cloudflare account and open TURN.
2. Create a TURN key, named for example `Twilight`. Copy its TURN key ID and the
   associated API token shown by the dashboard. Use the token associated with that
   key, not your Cloudflare global API key. See Cloudflare's
   [credential instructions](https://developers.cloudflare.com/realtime/turn/generate-credentials/).
3. Fill these existing names in the local `.env`:

   ```dotenv
   CLOUDFLARE_TURN_KEY_ID=your-turn-key-id
   CLOUDFLARE_TURN_API_TOKEN=your-turn-api-token
   CLOUDFLARE_TURN_TTL=3600
   ```

4. From the project folder run:

   ```powershell
   npm run setup:turn
   ```

   The helper uploads only those three settings to Twilight's Supabase project,
   using the authenticated Supabase CLI. If the CLI is signed out, run
   `npx supabase login`, then retry. The helper removes its temporary secrets file
   after uploading. Alternatively, set the three names directly under Supabase
   **Edge Functions → Secrets**.
5. Reload Twilight on both devices and test a voice call and a video call using
   different networks. No Vercel environment change or frontend rebuild is needed:
   this app's credential endpoint runs in Supabase.

Do not prefix these variables with `VITE_`. Remove the old `VITE_TURN_URL`,
`VITE_TURN_USERNAME` and `VITE_TURN_CREDENTIAL` settings from Vercel when convenient;
the new code does not read them. Local legacy TURN variables have been removed.

## Verification

Cloudflare credentials were configured and published to Supabase on 2026-10-26.
The authenticated endpoint now returns expiring Cloudflare ICE credentials.
Anonymous calls return 401 and unrelated relationship requests return 403.

The first configured test exposed an internal budget helper that accepted only
`ai` and `push` actions. Migration `allow_cloudflare_turn_request_budget` adds the
TURN action with an hourly window, preserving existing AI/push minute windows and
service-only grants. A rollback-only database test verifies the 30-request limit,
window boundaries, argument rejection and client permission denial.

Forced-relay Node WebRTC tests passed over UDP, TCP and TLS, with both selected
candidates verified as relay. Each transport carried 20 encrypted bidirectional
data-channel echoes. Observed median round-trip times were 60ms (UDP), 99ms (TCP)
and 100ms (TLS). These are measurements on this connection, not a latency guarantee.
See [verification details](RELAY_AND_ONBOARDING_VERIFICATION_2026-10-26.md).

The browser-control tool could not initialize during this verification, so the
current test does not establish browser microphone/camera playback or physical
device quality. Those acceptance checks remain required.

For a repeatable relay check, run `npm run dev:local` and open the development-only
`/tests/browser/calls.html?relay=1` harness on two isolated browser profiles/origins,
using synthetic accounts. Diagnostics must show `connection: connected`,
`relay: true`, audio packets on both sides, and decoded frames for video calls.
The harness generates audio/video and does not access a microphone or camera.
Production builds do not include this harness. Actual microphone/camera quality,
mobile background behavior, and different-network latency still require physical
device tests.

Cloudflare's [TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)
documents credential lifetime, connectivity, and billing. Review current account
usage there; Twilight does not impose a spending cap on the Cloudflare account.
