package com.gentlegurls.printagent.service
import android.app.*
import android.content.Intent
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.gentlegurls.printagent.PrintAgentApplication
import com.gentlegurls.printagent.R
import kotlinx.coroutines.*
class PrintAgentService:Service(){private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO);private val repo get()=(application as PrintAgentApplication).repository
    override fun onCreate(){super.onCreate();val channel=NotificationChannel("print-agent","Print Agent",NotificationManager.IMPORTANCE_LOW);getSystemService(NotificationManager::class.java).createNotificationChannel(channel);startForeground(41,NotificationCompat.Builder(this,"print-agent").setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Gentlegurls Print Agent").setContentText("Connecting and reconciling print jobs").setOngoing(true).build());repo.start();scope.launch{while(isActive){repo.heartbeat();delay(60_000)}};scope.launch{while(isActive){repo.reconcile();delay(300_000)}}}
    override fun onDestroy(){scope.cancel();repo.stop();super.onDestroy()};override fun onBind(intent:Intent?):IBinder?=null
}
