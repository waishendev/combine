package com.gentlegurls.printagent.service
import android.content.Context
import androidx.work.*
import com.gentlegurls.printagent.PrintAgentApplication
class ReconcileWorker(context:Context,params:WorkerParameters):CoroutineWorker(context,params){override suspend fun doWork():Result{(applicationContext as PrintAgentApplication).repository.reconcile();return Result.success()}}
class BootReceiver:android.content.BroadcastReceiver(){override fun onReceive(context:Context,intent:android.content.Intent){WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<ReconcileWorker>().build())}}
