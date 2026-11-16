package com.gentlegurls.printagent
import android.app.Application
import com.gentlegurls.printagent.data.*
import com.gentlegurls.printagent.security.CredentialStore
import androidx.work.*
import com.gentlegurls.printagent.service.ReconcileWorker
import java.util.concurrent.TimeUnit
class PrintAgentApplication:Application(){lateinit var repository:AgentRepository
    override fun onCreate(){super.onCreate();repository=AgentRepository(this,AppDatabase.create(this),CredentialStore(this),AgentPreferences(this));WorkManager.getInstance(this).enqueueUniquePeriodicWork("print-agent-reconcile",ExistingPeriodicWorkPolicy.KEEP,PeriodicWorkRequestBuilder<ReconcileWorker>(15,TimeUnit.MINUTES).setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())}
}
