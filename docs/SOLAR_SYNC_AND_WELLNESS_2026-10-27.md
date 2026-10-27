# Partner sync and interface corrections

## Live partner synchronization

The shared view was limited to 90 logs while the owner had 241. It also blocked
authorized health reads when the device was waiting for chat identity recovery.
PR #14 removed that coupling, kept encrypted chat recovery intact, and introduced
the same complete date-key pagination for own and shared health history. The
visible partner view catches up periodically even with a connected chat socket;
date rollover uses the local-day hook. Sharing permissions and database RLS were
preserved. The live production bundle's Supabase project reference was verified.

The live API check compares all 126 synthetic owner/partner records and confirms
that turning sharing off denies partner access. Only isolated QA accounts are
created/deleted by that script; real account rows/settings were not modified.

## Interface

- Sidebar icons have a stable centered column. Labels and brand text retain
  fixed widths and fade instead of compressing. One selection fill and a shared
  route-selection helper cover nested settings, notifications, and breathing.
- Solar bold-duotone icons by 480 Design are locally bundled, with theme colors
  and attribution in Settings/Account and `THIRD_PARTY_NOTICES.md`. Public SVG
  geometry is preserved except for rotation and a Solar mute-status composition.
  Game boards, charts, period-date drops, illustrations, reactions, and official
  provider logos retain their content; generic interface symbols use Solar.
- The desktop background fills the main pane. Overlays and chat chrome use
  graduated transparency/blur. Reduced-motion behavior remains in place.
- Four accidental `AppIcon` wrappers around conditionally rendered content were
  removed. They caused fallback stars below pages when the associated modal was
  closed. Empty/non-string icon requests now render nothing.
- The seven detailed scene assets are flat cartoon replacements. There are
  still 97 distinct illustration subjects; light/dark versions are not counted
  as additional subjects. Image provenance is in `wellness-raster-prompts.json`.
- Mobile tip titles, captions, explanations and actions have full-width space;
  artwork no longer forces them into narrow columns.
- Tracker Insights has Overview, Cycle, Trends, and Breathe. Cycle history and
  averages are visible directly in Cycle. Partner Insights separates Cycle,
  Logs, Sleep, and Energy. Both use one statistics implementation, respect
  explicit period starts, and count observed flow days rather than filling gaps.

## AI guidance

Dashboard, Insights and Wellness guidance is AI-generated. Prepared quotes are
explicitly labeled while a request is pending; failures offer retry. The existing
Nemotron Lightning non-thinking configuration remains the fast generation model.

Contexts use real non-demo check-ins and exclude future records and fictional
sample rows. Recent history is bounded to complete lines inside the prompt
limit. A five-minute, account/context-scoped memory cache deduplicates requests
across views; changed observations and explicit Refresh invalidate reuse. The
original request's auth token is pinned to prevent an account switch from
sending one account's context under another account's session. Nothing is cached
in localStorage or sent to an external image service during normal generation.

## Nearest Pad

Tracker and partner use one shared component. Location permission follows an
explicit action, with an area/city search fallback. Store coordinates are
validated, duplicates/far-away results are filtered, and proximity uses haversine
distance. Store phone links, walking/driving directions, route-preview errors,
loading, empty, denied-location and provider-error states are supported. The map
loads lazily and stale route/search responses cannot replace newer selections.

Stores are potential suppliers, not verified stock locations. The interface says
availability is unverified and offers calls before travel. Area search is served
by the authenticated Edge Function; invalid coordinates are rejected before the
rate-limit store is touched. Request validation no longer consumes AI allowance.

## Verification and limits

TypeScript, production build, Deno checks, app tests, local static previews, live
API checks, served CSS/assets, and a tracked-source credential scan are run for
this release. Added tests cover history pagination/sharing, quote/AI contexts,
cache isolation/refresh, map result validation and permission fallback, route
selection, cycle statistics, and conditional icon absence.

One smoke run encountered an intermittent verification failure. Transient auth
service errors now retry once and return 503 if still unavailable; invalid
credentials remain denied. No authentication fallback grants access. An invalid
coordinate check also exposed rate-store dependency before validation; validation
now happens first. These changes do not guarantee external service uptime.

Artwork was inspected on a rendered contact sheet. Browser automation still
fails to initialize (`failed to write kernel assets`), so interactive device
screenshots, exact pixel parity, and animation frame rates remain unverified.
