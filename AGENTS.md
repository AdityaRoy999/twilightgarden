# Frontend conventions

- Use Twilight's custom SVG icons from `components/ui/Icons.tsx` and the local
  illustration components. Add a drawing there for a new UI symbol. Do not add
  icon fonts, third-party icon packs, or emoji as navigation/control icons.
  User messages, game content, reactions, and official provider logos retain
  their content; they are not generic interface icons.
- Use the spring presets in `lib/motion.ts` for interface movement. Honor both
  operating-system reduced motion and the in-app animation preference. Initial
  chat history, pagination, receipts, and identity recovery must not replay
  message arrivals. Do not delay requests or navigation to wait for animation.
- Viewport overlays belong in `MotionPortal` or `SpringModal`, outside animated
  route transforms. Chat occupies the full content pane and owns one scroll area.
- After changing Tailwind configuration, restart the local server and run
  `npm run verify:ui`. Keep shared theme tokens in `styles/bloom.css` and
  reference-specific gradients in `styles/dark.css`.
