# Frontend conventions

- Use the locally vendored Solar icon adapter in `components/ui/Icons.tsx`, as
  explicitly requested by the user. Add Solar data/mappings there for new UI
  symbols. Keep attribution to 480 Design. Do not add remote icon requests,
  icon fonts, or emoji as navigation/control icons.
  User messages, game content, reactions, and official provider logos retain
  their content; they are not generic interface icons.
- Use the spring presets in `lib/motion.ts` for interface movement. Honor both
  operating-system reduced motion and the in-app animation preference. Initial
  chat history, pagination, receipts, and identity recovery must not replay
  message arrivals. Do not delay requests or navigation to wait for animation.
- Viewport overlays belong in `MotionPortal` or `SpringModal`, outside animated
  route transforms. Chat occupies the full content pane and owns one scroll area.
- Keep scrollbar tracks hidden while preserving scrolling. Selection uses fills
  and text colors without outlines; keep keyboard focus visible through a fill
  or underline. Reaction arrivals use the shared springs and retain real emoji.
- After changing Tailwind configuration, restart the local server and run
  `npm run verify:ui`. Keep shared theme tokens in `styles/bloom.css` and
  reference-specific gradients in `styles/dark.css`.
