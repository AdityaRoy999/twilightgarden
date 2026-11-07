// swift-tools-version: 6.1
import PackageDescription
let package = Package(name: "TwilightNativeCalls", platforms: [.iOS(.v15)], products: [.library(name: "TwilightNativeCalls", targets: ["TwilightNativeCalls"])], dependencies: [
    .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.3"),
    // Pinned revision includes the iOS 27 ScreenCaptureKit implementation.
    .package(url: "https://github.com/livekit/client-sdk-swift.git", revision: "df4194cdddc2f9cc065ae3144ac752740ceb7b22")
], targets: [.target(name: "TwilightNativeCalls", dependencies: [.product(name: "Capacitor", package: "capacitor-swift-pm"), .product(name: "LiveKit", package: "client-sdk-swift")], path: "ios/Sources")], swiftLanguageModes: [.v5])
