# Illustrated Wellness

The Wellness Tips, Sleep & Energy, and Partner Care views use the supplied white
and plum references: separate rounded advice cards, illustrations beside the
copy, purpose chips, refresh controls, and practical care actions. The existing
shadow-free styling, seven mobile destinations, custom UI icons, and reduced
motion preferences remain in effect.

## Artwork

97 distinct subjects: **7 generated transparent raster scenes and 90 authored
SVG scenes**. The SVG collection also has 90 dark palette counterparts; these
are the same subjects and are **not counted as additional illustrations**.

- Assets: `public/art/wellness/`.
- Subject manifest, keywords, icon, palette, and local paths:
  `lib/wellness-art-catalog.json`.
- Original vector geometry and generator: `scripts/generate-wellness-art.mjs`.
- Raster format conversion: `scripts/encode-wellness-art.py` (requires the
  original generated files on this machine; committed WebPs need no generation
  step to build or deploy).
- Raster prompts and provenance: `docs/wellness-raster-prompts.json`.

The raster scenes were created with the built-in image-generation tool, one
asset per call, with transparent backgrounds. They were resized and encoded as
WebP, preserving alpha. Seven images together are about 0.9 MB. No external
image service is needed at runtime; images load only when displayed. Images are
original interpretations of the references, not pixel-exact copies. Vector
scenes are simpler editorial drawings; the detailed human scenes are raster.

Run `npm run design:preview` to create local, fictional-data page previews plus
`/tmp/wellness-illustrations.html`, a searchable-by-browser illustration sheet
with a white/dark switch. `/tmp/design-preview.html` includes dedicated Tips,
Partner Care, and Sleep & Energy examples in both themes. These files are
ignored local review artifacts, not production routes.

## Matching and generation

AI responses now use three structured cards rather than one Markdown paragraph.
The prompt supplies the local subject catalog and asks for three different,
literal subject matches. The renderer validates IDs against that catalog and
matches title/body keywords, with specific title phrases weighted above general
body words. It corrects incompatible choices and uses a neutral care drawing for
unrecognized topics. No model-supplied URL becomes an image request. A generation
without three complete, distinct cards produces a retry state. Older Markdown
responses remain readable. This is deterministic keyword validation, not a
guarantee of semantic understanding of arbitrary prose.

Sleep distributions and the average-energy chart are computed from real logs.
Correlation percentages use only paired sleep/energy records, ignore invalid
categories, and do not display a relationship before three paired observations.
The graph shows measured means, without an invented rising trend line. Missing
categories remain blank. Counts and denominators are visible, and association
is not described as causation. The reference's detox claims are not copied.

## Verification

- TypeScript, production build, app tests, static component previews.
- App tests include hydration matching and refresh-without-flash regressions.
  Live API checks passed 72/72.
- Catalog test checks >80 unique subjects, different SVG geometry (excluding
  titles), all local files, theme variants, and no embedded remote images.
- Guide tests cover mismatches, external IDs, malformed/truncated JSON, legacy
  text, content limits, and prompt size.
- Live API smoke check uses the full catalog prompt for Tips and Partner Care,
  asserts three distinct illustrated cards, and cleans up its isolated accounts.
- Served CSS/asset verification checks both theme rules and WebP/SVG responses.

Artwork contact sheets were rendered with Sharp and visually inspected. Native
browser automation is unavailable in this desktop session, so responsive CSS
and static SSR previews were checked, but interactive browser screenshots,
animation frame rate, and device-level visual parity are not verified.
