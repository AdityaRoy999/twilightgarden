# Maps, charts, games and notification repair

## What changed

The chat background fills its full pane. Card containers are borderless; data
marks, board lines, checkboxes and QR codes retain the strokes that convey meaning.
Read receipts use Solar's linear double-check, fixing the solid blue square.
Chart tooltips show local calendar dates, weekdays, metric names and units.
Cycle intervals include the next start date; distribution tooltips include the
recorded date range. Donuts have rounded, borderless segments.

The report export is now a themed sheet with a preview, PNG/PDF export and native
or browser file sharing. It labels missing entries and uses calendar-day cycle
arithmetic. Sharing uses the system sheet; unsupported browsers download the file
for attaching to WhatsApp or email rather than claiming an attachment was sent.

Nearby pharmacies use Leaflet with OpenStreetMap tiles and Photon OSM place
search. The map stays visible without results and resizes when its container
changes. GPS is requested only on a click; area lookup remains available after a
permission denial. Search is authenticated, rate-limited, cached for ten minutes
per public location/query, and bounded by provider timeouts. It returns real
pharmacy coordinates, reported addresses and phone/hours when available. Directions
open OpenStreetMap. Stock and current opening status are **not verified**.

Photon's community endpoint is suitable for modest use, not an unlimited service
guarantee. For production scale, self-host Photon or use a supported hosted OSM
provider. Keep OSM attribution and respect the public tile policy:

- https://github.com/komoot/photon
- https://github.com/komoot/photon/blob/master/docs/api-v1.md
- https://operations.osmfoundation.org/policies/tiles/

## Shared game engine

All 19 games use one themed room and server-authoritative rule engine. The server
checks the authenticated participant, active relationship, turn, legal input and
room revision. A database transaction commits the public state and private secrets
together under a row lock. Concurrent creation joins one room; stale actions are
rejected. Client writes to version 2 rooms and reads of secret payloads are denied.
Older rooms are preserved, while the current client creates version 2 rooms.

Secret words, shuffled memory decks, correct answers, unrevealed RPS choices and
the lie in Two Truths remain service-only until the relevant reveal. Word Guess
uses multiplicity-aware feedback. Dots & Boxes retains the turn after completing
a box. Every game shares waiting, role/score, reveal, finish and rematch controls,
original rabbit/panda SVG avatars, theme tokens and reduced-motion behavior.

Conversation games prefetch short AI batches using the existing fast NVIDIA
model. Gentle, Playful and Bold levels affect the prompts; both players explicitly
ready themselves and can skip a round. Incomplete/invalid output produces a retry
state, never a silently substituted JSON question. Finish the Verse now uses
original AI rhymes. The unused static question files and old fixed MP4s were
removed, along with the duplicated game implementations and obsolete render project.

This is access control and secret-answer protection, **not full-app E2EE**.
Server-side game/health AI can process the inputs supplied to it. Encrypting all
health records end-to-end would require client-held data keys, device recovery,
partner key sharing, encrypted migrations and either on-device AI or explicit
consent to disclose selected context to a server model. Authentication and routing
metadata also need a separate minimization plan.

## Tutorials and notifications

The in-app guides use a lazily loaded Remotion Player, 19 game-specific scripts,
light/dark compositions, captions, chapter navigation, pause/replay, optional
original chimes and reduced motion. They use the bundled OFL Plus Jakarta Sans
font. All three chapters of all 38 themed compositions were rendered to 114 PNGs
and visually inspected as a contact sheet. Run `npm run tutorials:studio` or
`npm run tutorials:preview` to edit or verify them. `remotion/index.tsx` is the
single entry point; the root npm lockfile pins matching Remotion package versions.
Zod is overridden to a patched compatible release because the CLI's requested
version has a published advisory; rendering and npm audit pass with the override.

Invitations are created on the server for the verified caller's actual partner.
A deterministic notification ID prevents duplicate invitations for a room/sender.
In-app delivery works independently of push. Foreground/native notification taps
now route internally; role-specific screens resolve for the recipient. The local
self-test has a bounded service-worker wait, and native permission is explicitly
requested before enabling it. Self-tests never send a partner notification.

Free-Apple-ID unsigned iOS builds do not have APNs entitlement or background
calling. They support in-app alerts and permitted local notifications. Physical
iPhone permission/delivery testing remains necessary after signing. No real
recipient was sent an alert during QA.

## Verification

- 238 automated tests cover the rule engine, UI states, chart labels, notification
  routing/permissions/timeouts, existing authentication/sync and privacy behavior.
- Production API smoke: 68 checks including actual Kolkata GPS/area pharmacy
  results, auth guards, AI, private attachments, shared history and call credentials.
- Game API: 77 requests plus partner Realtime delivery and notification assertions;
  all 19 rooms, concurrent joins, a completed win, stale-action rejection, direct
  write denial, secret isolation, live AI prefetch/reveal, invitation deduplication,
  recipient reads and outsider denial. Three isolated accounts are removed in
  `finally`; no existing user data is reset.
- Build, TypeScript, six Deno function checks, theme checks, secret scanning and npm
  audit. The static page gallery renders real components using fictional fixtures.
- Browser interaction automation is unavailable on this host (CUA initialization
  fails). Rendered tutorials and static previews are not evidence of a complete
  interactive browser or real-iPhone walkthrough.

One local-to-production sample measured 77 game requests at p50 304 ms and p95
1,885 ms, including room creation/joins and AI work. The AI prefetch was 3,671 ms;
GPS pharmacy lookup 1,263 ms and area lookup 3,067 ms in another sample. These are
observations from this connection, not latency guarantees or controlled benchmarks.

Source licenses: Solar by 480 Design (CC BY 4.0) remains attributed in the existing
icon notices; the font license is bundled in `public/fonts/OFL.txt`. Mascots,
report art, tutorial code and chime are original project assets.
