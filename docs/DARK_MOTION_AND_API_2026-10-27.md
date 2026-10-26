# Dark reference, interaction, and endpoint repairs

## Interface changes

- White remains the initial appearance. Dark uses plum backgrounds, violet card
  gradients, rose outlines, lavender copy, and pink action surfaces. Local SVG
  illustrations adapt to both themes. Calendar, Insights, Chat, Games, Settings,
  notifications, and theme controls share the palette.
- All application shadows are disabled, including icon filters and message/nav
  shadows. Keyboard focus retains an outline. Borders and gradients separate
  surfaces instead.
- Tracker and partner mobile navigation expose all seven destinations directly:
  Today, Calendar, Insights, Chat, Wellness, Games, Account. Admin retains its five
  destinations. No secondary drawer is required for these destinations.
- Period dates use a pointed drop silhouette; prediction, fertility, and
  ovulation keep distinct markers and accessible date labels. The shared cycle
  hero has the reference's gently undulating edge. Actual dates remain data-driven.
- Chat fills the content pane with one message scroller. Text bubbles have
  rounded corners and curved tails; media has its own clipped frame. Outgoing
  copy uses a readable foreground. Initial history and older pages do not replay
  arrivals. Both pagination entry points preserve reading position.
- Interface icons are Twilight-authored SVG drawings in `Icons.tsx`. Lucide and
  the Material Symbols font dependency were removed. Message/reaction content
  remains content, rather than being converted into interface symbols.
- Empty logs use clipboard artwork; sleep uses moon artwork; games, notifications,
  and theme headings have distinct hearts, bell, and palette illustrations.

## Motion implementation

[Apple's spring animation session](https://developer.apple.com/videos/play/wwdc2023/10158/)
describes damped springs with continuous velocity when retargeted. No public
iMessage-specific constants were found. These are independently tuned web presets,
not a claim to reproduce private iMessage implementation details.

`lib/motion.ts` uses the physical equation `m*x'' + c*x' + k*(x-target) = 0`,
with `omega = 2*pi/T`, `k = m*omega^2`, and `c = 2*m*zeta*omega`. Here `T` is
natural period, not Apple's perceptual duration. Message arrivals use damping
ratio .8; route/scroll movement is critically damped. Modals, sheets, and selection
indicators share the presets. A retargetable MotionValue drives chat scrolling.

Insights previously used sequential exit/entry fades (`mode="wait"`), leaving a
blank interval. Content now replaces immediately and slides at full opacity.
Route entry likewise retains opacity, and a local Suspense boundary keeps the
shell/navigation mounted while lazy pages load. Game lists no longer stagger
from opacity zero. Nothing waits for animation before sending requests.

Viewport overlays render outside route transforms. The shared dialog handles
focus, Escape, and backdrop dismissal; an exiting dialog becomes inert and hidden
from accessibility APIs. OS reduced motion and the in-app motion preference are
both honored.

## Endpoint findings and fixes

- NVIDIA's former `meta/llama-3.1-8b-instruct` deployment returned HTTP 410.
  The deployed Supabase credential also returned 403 against the replacement,
  while the configured local credential succeeded. The hosted credential was
  updated from that verified local configuration, without exposing it to the
  browser or committing it.
- `NVIDIA_MODEL` now controls the server-side model. The default is the tested
  `nvidia/nemotron-3.5-lightning-30b-a3b`, using its documented
  [chat completion endpoint](https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-5-lightning-30b-a3b-infer).
  Empty provider output is an error instead of a fabricated successful reply.
  Provider status diagnostics omit provider response bodies and credentials.
- Invalid JSON objects/arrays previously became generic upstream/server errors
  in some handlers. Shared parsing now returns 400, and oversized bodies return
  413. AI, relay credentials, and both push aliases use this contract.
- AI frontend calls use timeout signals without orphaned timeout callbacks.
  Product, place, and routing fetches now have finite deadlines.

## Verification and limits

- 86 application tests pass, covering existing auth, encryption, synchronization,
  calls, logging, dates, and recovery, plus new arrival classification, physical
  spring validation, portal/dialog closure, and direct mobile navigation tests.
- Production build and Deno checks for all five canonical Edge Functions pass.
- `npm run verify:api` passes 71 live checks: all seven deployed function routes'
  method/auth/preflight contracts; authenticated RPC saves/reads; pairing and
  encrypted messages in both directions; Cloudflare credentials for both roles;
  synthetic-recipient push acceptance; malformed inputs; AI/product/place results;
  twelve client table routes; avatar and private partner attachment storage;
  game datasets, GIPHY, and OSRM routing. It cleans its synthetic accounts and
  storage objects in `finally` and records only status/timing evidence in `tmp/`.
- Scheduled reminders and real-user push delivery are not triggered by this
  smoke check. REST route probes do not replace row-level authorization tests.
  Credential issuance does not establish live audio/video quality or latency.
- `npm run design:preview` generates 56 actual pages in both appearances (112
  static previews). `npm run verify:ui` checks CSS actually served by Vite or a
  deployment, including paired tokens, gradients, full-pane chat, shadow removal,
  and both background assets.
- Browser tooling could not initialize in this session. Static rendering and
  automated checks do not establish pixel-perfect parity, physical-device
  dimensions, or measured frame rates. Review animation feel in the running app.

The existing advisor notices for intentional authenticated helper RPCs and the
public, code-based shared-card lookup were reviewed without broadening access.
Leaked-password protection remains disabled in the project configuration; this
is an outstanding Auth setting, not resolved by the endpoint repairs above.
