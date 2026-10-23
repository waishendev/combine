package com.gentlegurls.printagent
import android.content.Context
import android.provider.Settings
import com.gentlegurls.printagent.data.*
import com.gentlegurls.printagent.network.*
import com.gentlegurls.printagent.security.CredentialStore
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import okhttp3.OkHttpClient
import java.util.concurrent.atomic.AtomicBoolean
data class AgentState(val identity:DeviceIdentity?=null,val connected:Boolean=false,val running:Boolean=false,val lastHeartbeat:String?=null,val error:String?=null)
class AgentRepository(private val context:Context,private val db:AppDatabase,private val credentials:CredentialStore,private val prefs:AgentPreferences){
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO);private val client=OkHttpClient.Builder().pingInterval(java.time.Duration.ofSeconds(25)).build();private val api=AgentApi(client){credentials.read()};private val reconciling=AtomicBoolean(false);private var realtime:ReverbClient?=null
    private val mutable=MutableStateFlow(AgentState());val state=mutable.asStateFlow();val jobs=db.jobs().observe()
    init{scope.launch{prefs.identity.collect{mutable.update{s->s.copy(identity=it)}}}}
    suspend fun pair(name:String,code:String){val install=Settings.Secure.getString(context.contentResolver,Settings.Secure.ANDROID_ID);val data=api.pair(name,code,install)["data"]!!.jsonObject;credentials.save(data["token"]!!.jsonPrimitive.content);val d=data["device"]!!.jsonObject;prefs.save(DeviceIdentity(d["uuid"]!!.jsonPrimitive.content,d["name"]!!.jsonPrimitive.content,d["branch"]!!.jsonObject["name"]!!.jsonPrimitive.content));start()}
    fun start(){if(credentials.read()==null)return;mutable.update{it.copy(running=true,error=null)};realtime?.stop();realtime=ReverbClient(client,api,{mutable.value.identity?.uuid},{reconcile()}){connected->mutable.update{it.copy(connected=connected)}}.also{it.start()};reconcile()}
    fun stop(){realtime?.stop();mutable.update{it.copy(running=false,connected=false)}}
    fun reconcile(){if(!reconciling.compareAndSet(false,true))return;scope.launch{try{api.pending();while(true){val claim=api.claim()["data"]?.let{if(it is JsonNull)null else it.jsonObject}?:break;process(claim)}}catch(e:Throwable){mutable.update{it.copy(error=e.message)}}finally{reconciling.set(false)}}}
    private suspend fun process(claim:JsonObject){val job=claim["job"]!!.jsonObject;val id=job["id"]!!.jsonPrimitive.content;val type=job["type"]!!.jsonPrimitive.content;val claimId=claim["claim_id"]!!.jsonPrimitive.content;val token=claim["claim_token"]!!.jsonPrimitive.content;val message=job["payload"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull
        db.jobs().save(LocalJob(id,type,"processing",message));api.transition(id,"processing",claimId,token);runCatching{require(type=="test_print");db.jobs().save(LocalJob(id,type,"succeeded",message));api.transition(id,"succeeded",claimId,token,buildJsonObject{put("result_code","simulated")})}.onFailure{db.jobs().save(LocalJob(id,type,"failed",message));api.transition(id,"failed",claimId,token,buildJsonObject{put("error_code","unsupported_job");put("message",it.message?:"Processing failed");put("retryable",false)})}}
    suspend fun heartbeat(){runCatching{api.heartbeat()["data"]!!.jsonObject["server_time"]!!.jsonPrimitive.content}.onSuccess{time->mutable.update{it.copy(lastHeartbeat=time)}}}
}
