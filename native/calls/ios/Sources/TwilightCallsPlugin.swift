import Capacitor
import LiveKit
import AVFoundation
import UIKit

@objc(TwilightCallsPlugin)
public final class TwilightCallsPlugin: CAPPlugin, CAPBridgedPlugin, RoomDelegate, @unchecked Sendable {
    public let identifier = "TwilightCallsPlugin"
    public let jsName = "TwilightCalls"
    public let pluginMethods: [CAPPluginMethod] = ["capabilities", "connect", "disconnect", "microphone", "camera", "switchCamera", "screen", "layout"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var room: Room?
    private var revision = 0
    private var sessionId: String?
    private var microphoneEnabled = true
    private var audioSharing = false
    private var localView: VideoView?
    private var remoteView: VideoView?

    @objc func capabilities(_ call: CAPPluginCall) {
        if #available(iOS 27.0, *) { call.resolve(["available": true, "screen": true, "audio": true]) }
        else { call.resolve(["available": true, "screen": false, "audio": false, "reason": "System-wide sharing requires iOS 27 or the signed ReplayKit extension setup."]) }
    }
    private func run(_ call: CAPPluginCall, operation: @escaping @MainActor () async throws -> Void) {
        Task { @MainActor in
            do { try await operation(); call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func connect(_ call: CAPPluginCall) {
        guard let url = call.getString("url"), url.hasPrefix("wss://"), let token = call.getString("token"), let key = call.getString("key"), Data(base64Encoded: key)?.count == 32 else { call.reject("Invalid private media credentials."); return }
        run(call) { [self] in
            sessionId = call.getString("sessionId")
            revision += 1; let current = revision
            let previous = room; room = nil
            await previous?.disconnect()
            let provider = BaseKeyProvider(isSharedKey: true, sharedKey: key)
            let options = RoomOptions(defaultScreenShareCaptureOptions: ScreenShareCaptureOptions(appAudio: true), adaptiveStream: true, dynacast: true, e2eeOptions: E2EEOptions(keyProvider: provider))
            let next = Room(delegate: self, roomOptions: options); room = next
            try await next.connect(url: url, token: token)
            guard current == revision else { await next.disconnect(); return }
            microphoneEnabled = true; audioSharing = false
            AudioManager.shared.isMicrophoneMuted = false
            try await next.localParticipant.setMicrophone(enabled: true)
            if call.getBool("video") == true { try await next.localParticipant.setCamera(enabled: true) }
            guard let web = bridge?.webView, let parent = web.superview else { throw NSError(domain: "TwilightCalls", code: 1, userInfo: [NSLocalizedDescriptionKey: "Native video surface unavailable."]) }
            web.isOpaque = false; web.backgroundColor = .clear; web.scrollView.backgroundColor = .clear
            localView?.removeFromSuperview(); remoteView?.removeFromSuperview()
            let remote = VideoView(), local = VideoView()
            remote.isUserInteractionEnabled = false; local.isUserInteractionEnabled = false
            local.clipsToBounds = true; local.layer.cornerRadius = 20
            parent.insertSubview(remote, belowSubview: web); parent.insertSubview(local, belowSubview: web)
            remoteView = remote; localView = local
            refresh(next)
        }
    }
    @MainActor private func refresh(_ active: Room) {
        guard active === room else { return }
        let remotePublications = active.remoteParticipants.values.flatMap { $0.trackPublications.values }.filter { !$0.isMuted }
        let screen = remotePublications.first { $0.source == .screenShareVideo }?.track as? VideoTrack
        let camera = remotePublications.first { $0.source == .camera }?.track as? VideoTrack
        remoteView?.track = screen ?? camera
        remoteView?.layoutMode = screen == nil ? .fill : .fit
        localView?.track = active.localParticipant.trackPublications.values.first { $0.source == .camera && !$0.isMuted }?.track as? VideoTrack
        emit(["connected": active.connectionState == .connected, "remotePresent": !active.remoteParticipants.isEmpty, "sharing": active.localParticipant.isScreenShareEnabled(), "remoteSharing": screen != nil, "remoteVideoOff": screen == nil && camera == nil])
    }
    private func emit(_ value: JSObject) { var data = value; data["sessionId"] = sessionId; notifyListeners("state", data: data) }
    @objc func disconnect(_ call: CAPPluginCall) {
        run(call) { [self] in
            guard sessionId == call.getString("sessionId") else { return }
            sessionId = nil
            revision += 1; let previous = room; room = nil
            await previous?.disconnect(); localView?.removeFromSuperview(); remoteView?.removeFromSuperview(); localView = nil; remoteView = nil
            audioSharing = false
            AudioManager.shared.isMicrophoneMuted = false
        }
    }
    @objc func microphone(_ call: CAPPluginCall) {
        run(call) { [self] in
            guard let room else { return }
            microphoneEnabled = call.getBool("enabled") == true
            AudioManager.shared.isMicrophoneMuted = !microphoneEnabled
            try await room.localParticipant.setMicrophone(enabled: microphoneEnabled || audioSharing)
        }
    }
    @objc func camera(_ call: CAPPluginCall) { run(call) { [self] in try await room?.localParticipant.setCamera(enabled: call.getBool("enabled") == true); if let room { refresh(room) } } }
    @objc func switchCamera(_ call: CAPPluginCall) {
        run(call) { [self] in
            let track = room?.localParticipant.trackPublications.values.first { $0.source == .camera }?.track as? LocalVideoTrack
            guard let capturer = track?.capturer as? CameraCapturer else { throw NSError(domain: "TwilightCalls", code: 2, userInfo: [NSLocalizedDescriptionKey: "Camera is unavailable."]) }
            try await capturer.switchCameraPosition()
        }
    }
    @objc func screen(_ call: CAPPluginCall) {
        run(call) { [self] in
            guard let room else { return }
            guard #available(iOS 27.0, *) else { throw NSError(domain: "TwilightCalls", code: 3, userInfo: [NSLocalizedDescriptionKey: "Full-device sharing on this build requires iOS 27."]) }
            let enabled = call.getBool("enabled") == true
            audioSharing = enabled && call.getBool("audio") == true
            try await room.localParticipant.setMicrophone(enabled: microphoneEnabled || audioSharing)
            AudioManager.shared.isMicrophoneMuted = !microphoneEnabled
            // The explicit capture options also prevent device audio capture when the switch is off.
            try await room.localParticipant.set(source: .screenShareVideo, enabled: enabled, captureOptions: ScreenShareCaptureOptions(appAudio: audioSharing))
            refresh(room)
        }
    }
    @objc func layout(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            func place(_ view: UIView?, _ data: JSObject?) {
                guard let data else { view?.isHidden = true; return }
                let x = data["x"] as? Double ?? 0, y = data["y"] as? Double ?? 0, w = data["width"] as? Double ?? 0, h = data["height"] as? Double ?? 0
                view?.frame = CGRect(x: x, y: y, width: max(0,w), height: max(0,h)); view?.isHidden = (data["hidden"] as? Bool ?? false) || w <= 0 || h <= 0
            }
            place(remoteView, call.getObject("remote")); place(localView, call.getObject("local")); call.resolve()
        }
    }
    public func room(_ room: Room, didUpdateConnectionState state: ConnectionState, from old: ConnectionState) { Task { @MainActor in self.refresh(room) } }
    public func room(_ room: Room, participantDidConnect participant: RemoteParticipant) { Task { @MainActor in self.refresh(room) } }
    public func room(_ room: Room, participantDidDisconnect participant: RemoteParticipant) {
        Task { @MainActor in
            guard self.room === room else { return }
            emit(["ended": true]); self.room = nil
            await room.disconnect()
            localView?.removeFromSuperview(); remoteView?.removeFromSuperview(); localView = nil; remoteView = nil
        }
    }
    public func room(_ room: Room, participant: RemoteParticipant, didSubscribeTrack publication: RemoteTrackPublication) { Task { @MainActor in self.refresh(room) } }
    public func room(_ room: Room, participant: RemoteParticipant, didUnsubscribeTrack publication: RemoteTrackPublication) { Task { @MainActor in self.refresh(room) } }
    public func room(_ room: Room, participant: Participant, trackPublication: TrackPublication, didUpdateIsMuted: Bool) { Task { @MainActor in self.refresh(room) } }
    public func room(_ room: Room, didDisconnectWithError error: LiveKitError?) { if self.room === room { emit(["ended": true]) } }
    public func room(_ room: Room, trackPublication: TrackPublication, didUpdateE2EEState state: E2EEState) {
        if self.room === room && (state == .decryption_failed || state == .encryption_failed || state == .internal_error) {
            emit(["error": "Media encryption failed. End the call and retry."])
            Task { @MainActor in if self.room === room { await room.disconnect() } }
        }
    }
}
