# Self-hosted encrypted call media

Twilight supports its existing P2P/TURN calls and optional LiveKit rooms. Native
screen sharing uses a native LiveKit SDK. The browser uses the JS SDK in the same
room. Media encryption keys are generated on the calling device and sent only
through the existing encrypted, partner-authenticated signaling channel. The
token function receives no media key. LiveKit still sees connection metadata.

## Local server for verification

From the repository root:

```powershell
docker compose -f infra/calls/compose.yaml up -d
# Stop and remove the test container:
docker compose -f infra/calls/compose.yaml down
```

This binds development credentials to localhost only. It is not a public phone
test deployment. Native physical-device tests require an accessible WSS server.

## Production on AWS (single EC2 host)

Use the upstream LiveKit deployment generator; it provisions the required TLS
and TURN configuration rather than exposing the development server:

1. Register a domain/subdomains for the media endpoint and TURN endpoint.
2. On a Linux machine with Docker, run:

   ```sh
   docker run --rm -it -v "$PWD:/output" livekit/generate
   ```

   Choose the VM deployment and provide your domain names. Keep generated keys
   private. Follow the generated cloud-init instructions for an EC2 instance.
3. Start with a small dedicated instance for a two-person trial. This is a paid,
   always-running media service: the AWS free allowance/credits and egress costs
   depend on your account. Do not deploy an instance automatically from the app.
4. Assign an Elastic IP, configure DNS and the security-group ports required by
   the generated deployment (HTTPS/WSS, ICE TCP, media UDP and TURN). Do not open
   SSH to the world; use Systems Manager or an IP-restricted administration path.
5. Configure room limits: maximum two participants, no recording/egress service.
6. Verify TLS, TURN relay connectivity and calls between different networks.
7. Set the following **Supabase Edge Function secrets**, not frontend variables:

   ```text
   LIVEKIT_URL=wss://your-media-domain
   LIVEKIT_API_KEY=<generated API key>
   LIVEKIT_API_SECRET=<generated API secret>
   ```

8. Apply the encrypted-call-history migration and deploy `call-room`:

   ```powershell
   npx supabase db push
   npx supabase functions deploy call-room
   ```

   Inspect pending migrations before `db push`; use the project's normal release
   process. Preserve the existing Cloudflare TURN secrets for P2P calls.
9. New clients automatically use the configured encrypted SFU transport. The
   native SDK must be included in the installed build; an older IPA cannot gain
   native functionality through a website update.

For horizontal scaling, add Redis, multiple media nodes and a load balancer
following upstream guidance. This is unnecessary for the initial two-person
test. Stop EC2 to stop compute charges; disks, snapshots and retained/public IP
resources can still cost money. Stop both parties' calls before stopping it.

Upstream documentation:
https://docs.livekit.io/transport/self-hosting/vm/
https://docs.livekit.io/transport/encryption/

## Native checks

The native plugin is in `native/calls`. Run `npm ci`, build the web bundle, then
`npx cap sync ios` / generate and sync Android using the existing workflow.
iOS 27 capture requires an Xcode 27 SDK, the system content-sharing picker, and
the `screen-capture`/`audio` background modes. No additional screen-recording
entitlement is requested. Free-Apple-ID signing and background capture still
need device testing; unsigned compilation cannot prove sideloaded capture works.
Earlier iOS versions currently support native calls but not full-device capture
in this plugin. They require the additional signed ReplayKit extension target.

Test on physical devices: camera/mic permissions, cancel picker, screen with and
without audio, mute microphone while sharing device audio, rotate, switch apps,
stop through the system capture control, network handoff, remote hangup, unlink,
lock/unlock, native picture-in-picture and restoration, and new-device vault
restore. Android PiP must be enabled for the app in system settings.
Force-quitting is not backgrounding.
Protected apps may supply silence/blank frames. Never report these as successful
audio or screen sharing just because a capture track exists.
