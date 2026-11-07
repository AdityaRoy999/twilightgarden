package com.twilight.calls

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.view.View
import android.view.ViewGroup
import com.getcapacitor.*
import com.getcapacitor.annotation.*
import io.livekit.android.LiveKit
import io.livekit.android.RoomOptions
import io.livekit.android.audio.ScreenAudioCapturer
import io.livekit.android.e2ee.E2EEOptions
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.e2ee.E2EEState
import io.livekit.android.renderer.TextureViewRenderer
import io.livekit.android.room.Room
import io.livekit.android.room.track.*
import io.livekit.android.room.track.screencapture.ScreenCaptureParams
import kotlinx.coroutines.*
import livekit.org.webrtc.audio.JavaAudioDeviceModule

@CapacitorPlugin(name = "TwilightCalls", permissions = [Permission(alias = "media", strings = [Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO])])
class TwilightCallsPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var room: Room? = null
    private var localView: TextureViewRenderer? = null
    private var remoteView: TextureViewRenderer? = null
    private var localTrack: VideoTrack? = null
    private var remoteTrack: VideoTrack? = null
    private var audioCapturer: ScreenAudioCapturer? = null
    private var muted = false
    private var generation = 0
    private var sessionId: String? = null
    private var events: Job? = null
    @PluginMethod fun capabilities(call: PluginCall) = call.resolve(JSObject().put("available", true).put("screen", true).put("audio", Build.VERSION.SDK_INT >= 29))
    private fun run(call: PluginCall, work: suspend () -> Unit) { scope.launch { try { work(); call.resolve() } catch (e: Exception) { call.reject(e.message ?: "Native call operation failed.") } } }
    @PluginMethod fun connect(call: PluginCall) {
        if (getPermissionState("media") != PermissionState.GRANTED) { requestPermissionForAlias("media", call, "mediaPermission"); return }
        join(call)
    }
    @PermissionCallback private fun mediaPermission(call: PluginCall) {
        if (getPermissionState("media") == PermissionState.GRANTED) join(call) else call.reject("Camera and microphone permission is needed for this call.")
    }
    private fun join(call: PluginCall) = run(call) {
        val url = call.getString("url") ?: throw IllegalArgumentException("Media server is missing.")
        val token = call.getString("token") ?: throw IllegalArgumentException("Media token is missing.")
        val key = call.getString("key") ?: throw IllegalArgumentException("Media key is missing.")
        require(url.startsWith("wss://") && android.util.Base64.decode(key, android.util.Base64.DEFAULT).size == 32)
        generation += 1; val current = generation
        closeRoom()
        sessionId = call.getString("sessionId")
        val next = LiveKit.create(context.applicationContext, RoomOptions(adaptiveStream = true, dynacast = true, e2eeOptions = E2EEOptions(sharedKey = key)))
        room = next
        events = scope.launch { next.events.collect { event ->
            if (room !== next) return@collect
            when (event) {
                is RoomEvent.Disconnected -> emit(JSObject().put("ended", true))
                is RoomEvent.TrackE2EEStateEvent -> if (event.state in listOf(E2EEState.ENCRYPTION_FAILED, E2EEState.DECRYPTION_FAILED, E2EEState.INTERNAL_ERROR)) emit(JSObject().put("error", "Media encryption failed. End the call and retry."))
                else -> refresh(next)
            }
        } }
        next.connect(url, token)
        if (generation != current) { next.disconnect(); return@run }
        context.startForegroundService(Intent(context, CallAudioService::class.java))
        next.localParticipant.setMicrophoneEnabled(true)
        if (call.getBoolean("video", false) == true) next.localParticipant.setCameraEnabled(true)
        val web = bridge.webView; val parent = web.parent as ViewGroup
        localView = TextureViewRenderer(context); remoteView = TextureViewRenderer(context)
        listOf(remoteView!!, localView!!).forEach { view -> next.initVideoRenderer(view); view.isClickable = false; parent.addView(view, parent.indexOfChild(web), ViewGroup.LayoutParams(0, 0)) }
        web.setBackgroundColor(Color.TRANSPARENT); muted = false
        refresh(next)
    }
    private fun refresh(active: Room) {
        if (room !== active) return
        val publications = active.remoteParticipants.values.flatMap { it.trackPublications.values }.filter { !it.muted }
        val screen = publications.firstOrNull { it.source == Track.Source.SCREEN_SHARE }?.track as? VideoTrack
        val camera = publications.firstOrNull { it.source == Track.Source.CAMERA }?.track as? VideoTrack
        val nextRemote = screen ?: camera
        if (nextRemote !== remoteTrack) { remoteView?.let { remoteTrack?.removeRenderer(it); nextRemote?.addRenderer(it) }; remoteTrack = nextRemote }
        val nextLocal = active.localParticipant.getTrackPublication(Track.Source.CAMERA)?.track as? VideoTrack
        if (nextLocal !== localTrack) { localView?.let { localTrack?.removeRenderer(it); nextLocal?.addRenderer(it) }; localTrack = nextLocal }
        emit(JSObject().put("connected", true).put("remotePresent", active.remoteParticipants.isNotEmpty()).put("sharing", active.localParticipant.isScreenShareEnabled).put("remoteSharing", screen != null).put("remoteVideoOff", nextRemote == null))
    }
    private fun emit(value: JSObject) { notifyListeners("state", value.put("sessionId", sessionId)) }
    private suspend fun closeRoom() {
        events?.cancel(); events = null
        stopAudioCapture()
        room?.disconnect(); room?.release(); room = null
        localView?.let { localTrack?.removeRenderer(it); (it.parent as? ViewGroup)?.removeView(it); it.release() }
        remoteView?.let { remoteTrack?.removeRenderer(it); (it.parent as? ViewGroup)?.removeView(it); it.release() }
        localView = null; remoteView = null; localTrack = null; remoteTrack = null
        context.stopService(Intent(context, CallAudioService::class.java))
    }
    @PluginMethod fun disconnect(call: PluginCall) = run(call) { if (sessionId == call.getString("sessionId")) { generation += 1; sessionId = null; closeRoom() } }
    @PluginMethod fun microphone(call: PluginCall) = run(call) {
        val active = room ?: return@run; muted = call.getBoolean("enabled", false) != true
        if (audioCapturer != null) (active.lkObjects.audioDeviceModule as? JavaAudioDeviceModule)?.setAudioRecordEnabled(!muted)
        else active.localParticipant.setMicrophoneEnabled(!muted)
    }
    @PluginMethod fun camera(call: PluginCall) = run(call) { room?.localParticipant?.setCameraEnabled(call.getBoolean("enabled", false) == true); room?.let { refresh(it) } }
    @PluginMethod fun switchCamera(call: PluginCall) = run(call) { (room?.localParticipant?.getTrackPublication(Track.Source.CAMERA)?.track as? LocalVideoTrack)?.switchCamera() }
    @PluginMethod fun screen(call: PluginCall) {
        if (call.getBoolean("enabled", false) != true) { run(call) { stopAudioCapture(); room?.localParticipant?.setScreenShareEnabled(false); room?.localParticipant?.setMicrophoneEnabled(!muted); room?.let { refresh(it) } }; return }
        val manager = context.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(call, manager.createScreenCaptureIntent(), "screenPermission")
    }
    @ActivityCallback private fun screenPermission(call: PluginCall, result: androidx.activity.result.ActivityResult) {
        val data = result.data
        if (result.resultCode != Activity.RESULT_OK || data == null) { call.reject("Screen sharing was cancelled."); return }
        run(call) {
            val active = room ?: throw IllegalStateException("The call ended.")
            active.localParticipant.setScreenShareEnabled(true, ScreenCaptureParams(data, onStop = { scope.launch { stopAudioCapture(); active.localParticipant.setScreenShareEnabled(false); refresh(active) } }))
            if (call.getBoolean("audio", false) == true && Build.VERSION.SDK_INT >= 29) {
                val track = active.localParticipant.getTrackPublication(Track.Source.SCREEN_SHARE)?.track as? LocalVideoTrack ?: throw IllegalStateException("Screen capture unavailable.")
                active.localParticipant.setMicrophoneEnabled(true)
                val microphone = active.localParticipant.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack
                audioCapturer = ScreenAudioCapturer.createFromScreenShareTrack(track) ?: throw IllegalStateException("Device audio capture unavailable.")
                microphone?.setAudioBufferCallback(audioCapturer!!)
                (active.lkObjects.audioDeviceModule as? JavaAudioDeviceModule)?.setAudioRecordEnabled(!muted)
            }
            refresh(active)
        }
    }
    private fun stopAudioCapture() {
        (room?.localParticipant?.getTrackPublication(Track.Source.MICROPHONE)?.track as? LocalAudioTrack)?.setAudioBufferCallback(null)
        if (Build.VERSION.SDK_INT >= 29) audioCapturer?.releaseAudioResources()
        audioCapturer = null
        (room?.lkObjects?.audioDeviceModule as? JavaAudioDeviceModule)?.setAudioRecordEnabled(true)
    }
    @PluginMethod fun layout(call: PluginCall) {
        activity.runOnUiThread {
            val density = context.resources.displayMetrics.density
            fun place(view: View?, name: String) {
                val value = call.getObject(name) ?: return
                view ?: return
                view.x = (value.optDouble("x") * density).toFloat(); view.y = (value.optDouble("y") * density).toFloat()
                view.layoutParams = view.layoutParams.apply { width = (value.optDouble("width").coerceAtLeast(0.0) * density).toInt(); height = (value.optDouble("height").coerceAtLeast(0.0) * density).toInt() }
                view.visibility = if (value.optBoolean("hidden", false)) View.INVISIBLE else View.VISIBLE
            }
            place(remoteView, "remote"); place(localView, "local"); call.resolve()
        }
    }
    override fun handleOnDestroy() { scope.launch { closeRoom(); scope.cancel() } }
}
