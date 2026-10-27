# iPhone build with a free Apple ID

The **Build unsigned iOS app** GitHub Actions workflow builds a device IPA on a
macOS runner with Xcode 26. It bundles the web app, syncs Capacitor 8 plugins with
Swift Package Manager, and builds without any Apple password, certificate or
provisioning profile in GitHub. The artifact includes a SHA-256 checksum.

Run it from Actions → Build unsigned iOS app → Run workflow. Download the
TwilightGarden-unsigned-iOS artifact after the run succeeds. The repository
variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must contain the public
production client configuration. Never add service-role keys or TURN secrets.

The IPA is **unsigned**: iOS will not launch it until it is signed and provisioned
for your device. With a free Apple ID, use a local sideloading tool that supports
your OS (for example Sideloadly from https://sideloadly.io/), select this IPA and
your connected iPhone, and sign in directly in that tool. Review its instructions
and credential handling before entering your Apple ID; credentials never belong
in this repository or a chat. Enable Developer Mode if iOS asks and trust your
developer profile in iPhone Settings. Alternatively, open ios/App/App.xcodeproj
on a Mac, select your Personal Team in Signing & Capabilities, and run on the
connected device with Xcode. You may need a unique bundle ID for your team.

Apple's free Personal Team profiles expire after **7 days**, so the installed app
needs re-signing/reinstallation. A free account does not provide TestFlight,
App Store distribution, or the paid program's push notification capability.

This initial iOS wrapper supports foreground web features. Native background
calling/CallKit and APNs are separate integrations and are not enabled by this
unsigned build. Camera, microphone, photos and on-demand location permission
descriptions and the com.twilight.garden/twilight-garden URL schemes are included. Native Google sign-in uses the system browser and PKCE callback exchange; the
Supabase redirect allowlist must permit com.twilight.garden://google-auth. Test permissions,
login redirects and calls on an actual iPhone after signing. Local encryption
keys depend on the installed app's storage; keep a recovery method before
uninstalling or changing signing identity.

Sources: https://developer.apple.com/help/account/basics/about-your-developer-account
and https://capacitorjs.com/docs/ios.
