package com.twilight.calls
import android.app.*
import android.content.Intent
import android.os.IBinder
class CallAudioService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("twilight-calls", "Active calls", NotificationManager.IMPORTANCE_LOW))
        val open = packageManager.getLaunchIntentForPackage(packageName)
        val pending = open?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) }
        val notification = Notification.Builder(this, "twilight-calls").setSmallIcon(android.R.drawable.sym_call_incoming).setContentTitle("Twilight call in progress").setContentText("Tap to return to your call").setContentIntent(pending).setOngoing(true).build()
        startForeground(3407, notification)
        return START_NOT_STICKY
    }
}
