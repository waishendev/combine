package com.gentlegurls.printagent.network

import com.gentlegurls.printagent.BuildConfig
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class AgentApi(private val client:OkHttpClient,private val token:()->String?){
    private val json=Json{ignoreUnknownKeys=true}; private val media="application/json".toMediaType()
    suspend fun pair(name:String,code:String,installation:String)=post("print-agent/pair",buildJsonObject{put("device_name",name);put("pairing_code",code);put("installation_id",installation);put("app_version",BuildConfig.VERSION_NAME)},false)
    suspend fun heartbeat()=post("print-agent/heartbeat",buildJsonObject{put("app_version",BuildConfig.VERSION_NAME)})
    suspend fun pending()=get("print-agent/jobs/pending")
    suspend fun claim()=post("print-agent/jobs/claim-next",buildJsonObject{})
    suspend fun transition(job:String,state:String,claimId:String,claimToken:String,extra:JsonObject=buildJsonObject{})=post("print-agent/jobs/$job/$state",buildJsonObject{put("claim_id",claimId);put("claim_token",claimToken);extra.forEach{(k,v)->put(k,v)}})
    suspend fun channelAuth(socketId:String,channel:String)=post("broadcasting/auth",buildJsonObject{put("socket_id",socketId);put("channel_name",channel)})
    private suspend fun get(path:String)=execute(Request.Builder().url(BuildConfig.API_BASE_URL+path).get())
    private suspend fun post(path:String,body:JsonObject,auth:Boolean=true)=execute(Request.Builder().url(BuildConfig.API_BASE_URL+path).post(body.toString().toRequestBody(media)),auth)
    private suspend fun execute(builder:Request.Builder,auth:Boolean=true):JsonObject=suspendCancellableCoroutine{c->
        if(auth) token()?.let{builder.header("Authorization","Bearer $it")};builder.header("Accept","application/json")
        val call=client.newCall(builder.build());c.invokeOnCancellation{call.cancel()};call.enqueue(object:Callback{override fun onFailure(call:Call,e:java.io.IOException){if(c.isActive)c.resumeWithException(e)};override fun onResponse(call:Call,response:Response){response.use{val text=it.body.string();if(!it.isSuccessful){c.resumeWithException(IllegalStateException("HTTP ${it.code}: $text"));return};c.resume(json.parseToJsonElement(text).jsonObject)}}})
    }
}
