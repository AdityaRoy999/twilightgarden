# Reaction, navigation, Wellness, and journal refinements

- Reaction chips use the shared physical springs when a reaction is added,
  removed, or its count changes. Initial history stays still. Emoji content and
  the existing optimistic update/rollback remain intact. Both motion preferences
  are respected.
- Scrollbar tracks are hidden globally without changing overflow/scrolling.
  Selection uses fills instead of outlines/rings. Keyboard controls retain a
  visible fill or underline. Dark message/media borders are removed as well.
- Sidebar width, labels, brand, and footer animate together. Its links stay
  mounted and usable while collapsing. Short desktop windows prioritize the
  complete navigation over the decorative footer.
- Log Details follows the supplied white/dark references: date heading, separate
  period, flow, mood, energy, sleep, physical, digestion, and notes cards; distinct
  flow-level drawings; a sleep ruler; and a responsive save action. An absent sleep
  duration is shown as unlogged rather than being treated as poor sleep.
- Shared symptoms such as nausea/bloating stay selected consistently across
  categories. Removing either clears the shared value. Reset remains a draft
  change, so a realtime refresh cannot silently restore the previous contents.
- Wellness now has constrained content/artwork, an always-visible context card,
  an illustrated loading state, responsive tabs, and spring section changes.
  Per-view requests deduplicate work and isolate their loading/error states;
  stale account/context responses cannot replace the current view. Partner care
  uses the same request helper. Leaflet markers are authored local SVGs without
  remote marker or shadow-image requests.
- Security verification keeps its QR/code/scanner protocol, with a responsive
  QR surface and more compact, wrapping code text.

## Wellness generation regression

A full Wellness request returned 502 even though the earlier short “OK” probe
worked. A direct provider check confirmed all 1,024 completion tokens were used
as reasoning tokens, with no visible content and a `length` finish reason.
For the configured Nemotron model, the handler now requests direct answers using
`chat_template_kwargs.enable_thinking = false`, as described in
[NVIDIA's instructions](https://build.nvidia.com/playbooks/nim-llm/instructions).
The live Wellness request then returned HTTP 200 with visible guidance (466
characters in approximately 3.5 seconds in one check; this is not a latency SLA).
The live smoke check now uses a complete Wellness prompt and asserts visible
output, so the previous short-probe blind spot is covered.

## Requested sample history

The explicitly requested account received 240 fictional daily check-ins spanning
2026-02-28 through 2026-10-25, including eight period starts and varied moods,
symptoms, sleep, and energy. Every sample note starts with
`[Sample history: twilight-demo-v1]`. There are 241 total logs after insertion.
The existing log was compared before/after and preserved; cycle settings,
authentication, identities, and chat history were not changed. No daily-log
database triggers were present, and seeding does not invoke push/reminder jobs.

The opt-in script requires both `DEMO_TARGET_EMAIL` and a verified account ID,
checks they match, and uses conflict-ignore inserts by `(user_id,date)`. Repeating
it cannot overwrite existing entries. It never seeds the anchor date or future
activity. The supplied cycle anchor remains unchanged.

## Verification

95 application tests pass, including per-tab request races/retries, Wellness
loading/errors, reaction grouping, sample-date validity, and journal reset/shared
symptoms. TypeScript, production build, Edge Function checks, all 71 live API
checks, and the 112-layout static gallery pass. The API fixtures clean their
temporary accounts and storage. Actual served CSS is checked locally and after
deployment. Browser capture is unavailable in this session; these checks do not
establish pixel parity or physical-device animation frame rates.
