# Controls, movement, gifts and performance

This release uses darker rose selection fills in light mode, theme-aware Solar
controls, and original SVG flow/mood/energy symbols. Section tabs change through
a short color fade with no sliding pill. Chat read receipts use a single blue.
The missing log symbols were caused by passing React nodes into the icon-name
registry; the selector now renders its supplied nodes directly.

The cycle ring reveals once per account per app session and removes its reveal
mask after the animation to avoid a permanent seam. Saved period duration controls
the number of period marks. The marker uses civil local time, updating once per
second while the page is visible. Noon on day two falls halfway between marks two
and three. Predictions never reset an overdue cycle. An information button opens
an animated, three-part explanation. All movement respects reduced motion.

Exercise replaces the old standalone Breathe section, with 44 original two-pose
SVG sets and 44 dark companions. Suggestions use recent non-demo check-ins only;
missing history is explicitly generic. Breathing remains inside Exercise. Each
guide includes cues, a related NHS source and a clearly labeled YouTube search
for the specific movement, rather than an invented video URL.

Caregiver gifts have a partner header, care/gifts/nearby sections, an illustrated
banner, platform and category filters, price sorting and photo cards. Store
counts/results/prices come from actual search responses. Unknown prices sort
last. Favorites are for the current visit. Requests are deduplicated during
Strict Mode mounting, scoped to account/context, and bounded by a retry deadline.

## Performance evidence

See performance-2026-10-27.json for all measured request summaries and bundle
files. Entry/preload JavaScript fell from **373,314 to 253,508 gzip bytes (32.1%)**.
Charts no longer share the globally preloaded animation chunk. PDF/image export
and identity-recovery UI load only when needed. This measures startup entry and
preload files, not all route downloads or device paint latency.

Seven warmed authenticated history reads of 241 synthetic logs measured p50/p95
**79/670 ms before**, **69/95 ms in the final sample**. An intermediate run measured
237/373 ms: internet/host conditions vary, and this is too small a sample to claim
a guaranteed or causal network improvement. Profile reads were slower in the
final sample (54/62 to 99/129 ms). No fabricated universal latency target is claimed.

The deployed database migration removes only three exact duplicate non-unique
indexes, preserving the matching UNIQUE/PRIMARY KEY indexes and all user data,
constraints and RLS policies. Repeated warm database-only execution of the same
241-row history query was 0.209–0.231 ms before and 0.213–0.269 ms afterwards,
using the retained unique index and the same 17 buffer hits. This reduces index
write/maintenance work; it does not prove a faster read. Unused-but-distinct
indexes were retained rather than removed from a small-traffic sample.

The Supabase advisors still flag intentionally callable SECURITY DEFINER RPCs
and service-only private tables with RLS/no policies; their existing grants and
guards remain in place. Leaked-password protection is disabled in project Auth
settings. No policies were relaxed for performance.

## Adaptive calls

Microphone capture requests speech processing, echo cancellation, noise
suppression and mono input. Opus is preferred where supported. Camera capture
can reach 1080p/30 on capable devices. A two-second stats sample measures selected
ICE-pair RTT, available outgoing capacity, packet loss, actual sent video height
and bitrate, and received audio jitter. Video has five target tiers, down to
audio priority. It downgrades promptly and waits for three good samples before
raising one tier, avoiding quality oscillation. Camera permission and TURN
credential retrieval now start in parallel.

Encoding limits are ceilings; the browser's congestion control remains active.
Unsupported sender-tuning APIs fall back to browser behavior. Actual quality
depends on bandwidth, hardware and both endpoints; HD cannot fit a tiny link.
Severely weak links pause video to preserve speech. Encryption/signaling guards
are unchanged. These paths have unit/integration coverage but have not been
validated on two real phones or under a controlled weak-network call.

## Verification limits

171 unit/component tests, production TypeScript/build, Edge Function type checks,
static design preview generation, stylesheet/artwork serving, and 76 live API
checks passed. API fixtures clean up only their synthetic accounts; no real user
notifications or data resets run. Browser tooling is unavailable on this host,
so no pixel-perfect, interactive frame-rate, iPhone or real-call quality claim is
made. iOS build/signing instructions are in ios-sideload.md.

Full end-to-end encryption of health data remains a separate migration: current
health rows are not all E2EE. Server-side AI needs plaintext inputs; fully private
health processing would require on-device inference or explicit user-approved
disclosure of selected data. Account metadata/routing information also needs a
separate threat model. Existing encrypted chats and call transport are retained.
