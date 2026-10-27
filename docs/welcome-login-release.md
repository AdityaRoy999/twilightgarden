# Welcome and iPhone safe-area correction

The welcome screen has three original SVG scenes: cycle tracking, daily care,
and partner connection. They are decorative, independent of CycleBloom, so the
welcome screen no longer inherits its interactive ring explanation button.
Desktop shows all three cards; phones use three manually selected cards with
stable spacing and accessible 44px pagination targets. Both themes use local
artwork and theme tokens, without image requests or new dependencies.

Track My Cycle opens `/login`; Join as Partner opens `/partner/login`.
Create-account, return-to-login and recovery links preserve the selected role.
Signup no longer repeats the role picker. Database-authoritative account roles
and authentication handlers are unchanged.

The viewport uses `viewport-fit=cover`. Public auth screens, welcome and the
app shell account for the system safe-area insets. Standalone games account for
the inset themselves; games inside AppShell avoid applying it twice. The auth
back control keeps a 44 by 44px touch target below the status bar.

Validation: 244 tests passed, including four new navigation/illustration checks;
production build and served-theme verification passed. Browser checks covered
390x844 and 320x568 phone widths, direct partner login/signup, and desktop dark
mode. With a simulated 59px top inset, the back target started at y=77px and
remained 44 by 44px. This is layout simulation, not physical iPhone testing.
The installed iOS app needs the rebuilt IPA to receive the bundled changes.
