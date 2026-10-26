# Twilight Garden · Bloom

The user's first dashboard reference sets the direction: a warm blush canvas,
white rounded cards, deep plum typography, coral and rose accents, botanical
details, and a segmented cycle ring. Apply the same visual language to both
partners, account flows, calendars, wellness, chat, and games.

## Tokens

The source of truth is `styles/bloom.css`. Tailwind's existing background aliases
resolve to semantic CSS variables, including their dark variants.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#fff1f7` | `#1d1721` |
| Surface | `#ffffff` | `#2a212f` |
| Primary text | `#101333` | `#fff4f9` |
| Secondary text | `#6e6b8f` | `#c4b4cb` |
| Action | `#c33367` | User's accent |
| Supporting colors | Mint, lavender, warm amber | Muted tonal equivalents |

Use Plus Jakarta Sans, sentence case, short friendly copy, and a 4/8px spacing
rhythm. Default card radii are 24–32px. White-on-primary contrast is 5.26:1;
secondary text on white is 5.52:1. Decorative pink is lighter than action text.
Keep health estimates explicitly labeled and derive every date from the cycle
model. Never copy the reference image's inconsistent example dates or claim a
pregnancy probability from calendar estimates.

## Motion

- Press feedback: 180ms `cubic-bezier(.2,.8,.2,1)`.
- Card elevation: 220ms `cubic-bezier(.22,1,.36,1)`; hover only on devices that
  support hover. No layout shift.
- Route content: 220ms opacity transition. Shared providers stay mounted.
- Sheets: 260ms translate/opacity entrance.
- No waiting for an animation before a button action executes.
- Both `prefers-reduced-motion` and the in-app animation preference disable
  CSS motion, Framer transitions, smooth quick-log scrolling, and chart motion.
- Breathing exercise timing and network/call protocols retain their behavior.

## Assets and components

Lucide supplies the open-source icon family already installed in the project.
`CycleBloom` and `BotanicalSprig` are local SVG illustrations; no new stock-photo,
image-generation, asset hosting, or paid dependency is required. Cycle rings use
unique SVG definition IDs. Initials are the fallback avatar, never a fictional
person's photo presented as the user.

`bloom-card`, the shared app shell, `ChartEmptyState`, and semantic surfaces carry
the visual language through existing feature screens. Keep game-specific board
colors when they communicate players or game rules.

## Preview and coverage

Run `npm run design:preview` while Vite is running. Open
`http://127.0.0.1:3000/tmp/design-preview.html`. The generator renders all 56 page
modules with fictional fixtures and the actual app shell, with phone/desktop
layout controls and filters. Game previews show ready-to-start lobbies.
Redirect-only authentication endpoints are omitted. This is a static visual
gallery, not a substitute for exercising the live app's interactions.

The generator lives outside the production entry graph. It runs no React effects,
uses no production providers, disables fetch, and never writes database rows.
The generated HTML lives in ignored `tmp/` and is not shipped to Vercel.

On the first load of this design update, the app adopts the requested light
appearance and replaces the old default accent. Subsequent appearance choices
and custom accents persist. Reset restores Bloom's light default.


## White-mode reference update

`styles/bloom.css` is the single owner of light/dark color variables. Do not put
another copy in `index.css`. `styles/reference.css` holds the reference layouts
and the local botanical canvas (`public/art/bloom-background.svg`). Light and dark
surface/text tokens change together on `:root.dark`.

Calendar, Insights, chat, Settings, Notifications, Theme, and Mini Games follow the
new page-specific references. Calendar is shared with the partner view, keeping
sharing consent and read-only journals. Do not adopt sample health correlations,
avatars, online statuses, or account details from design references as app data.

The color picker uses an accessible foreground and darker link shade for pastel
accents. Color selection stays editable as a six-digit hex field; partial edits
remain visible until completion or blur. Floating navigation reserves 92px plus
safe-area space and highlights More on secondary pages.

Restart Vite after changing Tailwind configuration. The previous dev process kept
old literal dark background rules even after the production config had changed;
checking HTML/component rendering alone did not detect that. Verify the actual
served `/index.css?direct` alongside the built stylesheet when changing tokens.
