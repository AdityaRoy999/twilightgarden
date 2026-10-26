# White-mode reference UI

The page-specific references replace the earlier generic styling pass. The main
pages now share a pink botanical canvas, white rounded cards, navy headings,
lavender secondary text, soft icon artwork, and floating white navigation.

## Concrete changes

- Calendar uses a spacious month grid, explicit period/estimated markers, a
  four-item legend, a phase card, and cycle settings at a glance. Tracker and
  partner use the same component; partner journals stay read-only and require
  sharing consent. Future estimates never create activity rows.
- Insights starts with the illustrated symptoms state, followed by a sleep card
  and report action. History/averages remain available in an expandable section;
  Trends remains a separate view. The reference's fabricated sleep correlation
  is not used as a claim about the user.
- Settings has the reference's profile card, accessible switches, and theme
  card. Notifications has matching permission, preference, and test cards.
- Theme has a preview, editable color picker, and twelve soft presets. Partial
  hex edits work, the hue endpoint wraps correctly, and pastel accents receive
  readable button foregrounds and link colors.
- Mini Games has illustrated game tiles and category controls. Play and tutorial
  controls are siblings, removing the previous invalid nested buttons. Existing
  game-session and invitation handlers remain connected.
- Chat uses the matching pink/white surfaces and round actions. Actual partner
  messages, encryption, calling, and recovery behavior are retained; the sample
  assistant persona and messages from the design image are not injected.
- More highlights secondary pages; the solid/blurred navigation setting now
  affects the shared shell. Mobile content reserves space for the floating bar.

## Cause of the reported dark-card screenshot

The long-running local Vite process was still emitting literal dark Tailwind
colors, even though the production build emitted theme variables. It was stopped
and restarted. Color variables now have a single owner in `styles/bloom.css`,
with paired light/dark surface and text values. The static gallery explicitly
loads all three stylesheets as CSS, including the reference layout stylesheet.

`npm run verify:ui` checks the actual local CSS response and the botanical asset.
Pass a deployment origin to check the deployed CSS. It fails on literal dark
surface utilities and mismatched light/dark tokens, catching the failure that
component tests alone missed.

The 56-page static gallery is regenerated with `npm run design:preview`. Browser
capture still fails to initialize in this environment; static rendering, CSS
artifact checks, tests, and builds do not establish pixel-perfect visual parity
or physical-device layout correctness.

Local validation: all 78 application tests passed; the 56-page generator and
production build passed; served CSS/theme checks passed on both port 3000 (dev)
and port 4173 (built preview).
