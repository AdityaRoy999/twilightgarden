# Rounded navigation and connected botanical artwork

The mobile bar uses a 22px rounded rectangle with identical 16px selection corners for every tab. Light mode uses #fff0f5 selection fill and #a93464 active icon/text; dark mode uses a quiet plum fill with readable rose ink. Selection changes retain color fades, with no sliding highlight, borders, or shadows. Bar height, safe-area behavior, and seven destinations remain intact.

All shared decorative foliage now uses one quadratic stem and four leaf bases evaluated on that curve, with veins starting at the same attachment coordinates. Dashboard, headings, history cards, welcome scenes, both page backgrounds, and all 90 paired wellness SVG scenes use the shared geometry. Original scene subjects and raster illustrations remain intact.

Validation: production build and TypeScript passed; UI theme verification passed; the design gallery rendered all 63 pages in both themes. Browser inspection at 393px verified all seven identical selection radii and the expected pale fill/darker ink. At 320px all seven targets measure 44 by 68px with no horizontal overflow. XML/geometry checks verified 182 SVG files and exact attachment of all four shared leaf bases and veins. Existing CI runs the regression suite before release.

Regenerate static artwork with `node scripts/generate-background-botanicals.mjs` and `node scripts/generate-wellness-art.mjs`. Both use lib/botanicalGeometry.json, as does the React BotanicalBranch component.
