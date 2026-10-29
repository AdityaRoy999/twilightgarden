# Call studio and mobile chat

Calls now fill the content area. Controls overlay the video and fade after five
seconds; a tap reveals them. The local preview supports pointer dragging and
arrow-key movement. Minimize keeps a call visible while navigating the app.
The preview uses the whole safe viewport, retaining its position across minimize
and expand. One size button toggles the in-app view; optional browser fullscreen
lives in More. Controls use equal grid columns and theme tokens, with white
surfaces in light mode.

Camera switching and screen sharing replace the existing video sender; microphone
capture and the encrypted peer connection remain intact. Share permissions are
requested only after a click. Cancelled permissions, late camera grants, hangup,
and disconnect clean up the sources. Screen-share state and original reaction
stickers travel through the existing encrypted private call signaling channel.

## Platform support

| Feature | Availability |
| --- | --- |
| Foreground voice/video, mute, camera toggle, reactions | Supported WebRTC browsers / current Capacitor app |
| Fullscreen stage and overlay controls | All layouts; browser fullscreen additionally requires Fullscreen API support |
| Draggable preview and in-app minimize | All layouts |
| Camera switching | Device must expose the requested camera; previous facing mode is restored if acquisition fails |
| Screen sharing | Supported desktop `getDisplayMedia` browsers; native iOS/Android builds explicitly report that a native capture integration is missing |
| System picture-in-picture | Exposed only when the video API reports support; native iPhone cross-app calling still needs an AVKit/media bridge |
| Soft light / glow / warm / cool / mono | Local GPU processing; requires canvas capture and WebGL |
| Background blur | Additional local module worker and WebAssembly SIMD support; never uploads video for inference |
| Ringtone while the app is open | Audio is unlocked on an app gesture; an explicit enable action appears if blocked |
| Incoming calls when iOS closes the app | Not implemented. Requires native PushKit/CallKit, APNs credentials and supported signing capabilities; the free Apple ID build cannot provide reliable closed-app ringing |

Effects are optional and capped at 720p/24fps. Background segmentation runs in a
worker at up to 10fps; GPU passes composite video without full-frame pixel
readback. Until a valid segmentation mask exists, the complete frame is blurred.
Natural camera calls keep the existing adaptive video/audio bitrate policy.

## Capture suspension and foreground recovery

Desktop display tracks remain attached when the call page becomes hidden. Track
mute/unmute events publish an encrypted pause state bound to the current call and
partner. A receive-side frame watchdog also hides a stale frame after six seconds
without decoded video. It does not disconnect audio. Camera-off state is separate
from capture interruption, and does not hide an actively shared screen.

Visibility and native app-state events resume video playback and the existing
effect processor. An OS-ended camera is reacquired on return with its previous
camera-off setting and background effect preserved. Recovery never replaces a
blurred camera with unprocessed frames. A disconnected connection requests ICE
recovery when returning to the app; a healthy connection is left intact.

**The current installed iPhone build cannot share other apps in the background.**
Its WebRTC sources live in WKWebView. Merely detecting `getDisplayMedia`, adding a
background plist flag, or keeping a JavaScript timer alive does not supply native
screen frames. Implementing this needs an iOS capture path (ReplayKit broadcast
extension for the current SDK/OS range, or an appropriately available newer native
capture API), a native WebRTC media bridge, supported signing/capabilities, and
physical-device verification of capture, suspension, resume, audio, and hangup.
That native path is not included in this release. Receiving a desktop screen
share continues to use the existing incoming video stream on iPhone.

MediaPipe Tasks Vision 1.2.0 and its Selfie Segmenter are self-hosted under
`public/call-effects`; license and model checksum are included there. The 14MB
WASM runtime is fetched only when background blur is selected. These are lighting
and background effects, not facial reshaping or a proprietary beauty engine.

## Chat

One attachments menu holds photos, GIFs and AI notes. The 16px input prevents iOS
focus zoom while retaining manual pinch zoom. GIFs use smaller visible thumbnails,
debounced searches, cancellation, bounded waits, and explicit failures. Results
are requested directly from GIPHY without response caching. AI composition runs
in an independent sheet; closing cancels the request. Both sheets use shared
springs, focus management and reduced-motion preferences.

Navigation uses consistent rounded corners; disabling the solid background leaves
the panel and its surrounding region transparent. A masked blur fades the top
safe-area transition. Native ProMotion opt-in is enabled; the OS/WebView still
chooses rendering cadence and may reduce it for power or thermal reasons.

## Verification

`tests/browser/call-studio.html` is development-only and uses fictional generated
media over two real local RTCPeerConnections. It verifies processed outgoing
video, reactions, minimization, preview movement and sheets without opening a
camera or exposing private chats. It includes rolling frame timing diagnostics.
Browser measurements are not physical iPhone/Android certification; native PiP,
camera routing and device-specific effects require checks on the installed app.

Lifecycle and security regressions are covered in `tests/calls.test.tsx`,
`tests/call-video.test.ts`, `tests/gif-picker.test.tsx` and
`tests/request-signal.test.ts`.
