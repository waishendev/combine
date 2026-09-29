package com.gentlegurls.printagent.network
import com.gentlegurls.printagent.BuildConfig
import kotlinx.coroutines.*
import kotlinx.serialization.json.*
import okhttp3.*
import java.util.concurrent.atomic.AtomicBoolean
class ReverbClient(private val client:OkHttpClient,private val api:AgentApi,private val deviceUuid:()->String?,private val onWake:()->Unit,private val onState:(Boolean)->Unit){
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO);private val running=AtomicBoolean(false);private var socket:WebSocket?=null;private var attempt=0
    fun start(){if(running.compareAndSet(false,true))connect()};fun stop(){running.set(false);socket?.close(1000,"stopped");scope.cancel()}
    private fun connect(){if(!running.get())return;socket=client.newWebSocket(Request.Builder().url(BuildConfig.REVERB_WS_URL+"?protocol=7&client=android&version=1.0&flash=false").build(),object:WebSocketListener(){
        override fun onOpen(webSocket:WebSocket,response:Response){attempt=0}
        override fun onMessage(ws:WebSocket,text:String){scope.launch{handle(ws,text)}}
        override fun onClosed(webSocket:WebSocket,code:Int,reason:String){onState(false);retry()}
        override fun onFailure(webSocket:WebSocket,t:Throwable,response:Response?){onState(false);retry()}
    })}
    private suspend fun handle(ws:WebSocket,text:String){val root=runCatching{Json.parseToJsonElement(text).jsonObject}.getOrNull()?:return;when(root["event"]?.jsonPrimitive?.content){
        "pusher:connection_established"->{val data=Json.parseToJsonElement(root["data"]!!.jsonPrimitive.content).jsonObject;val socketId=data["socket_id"]!!.jsonPrimitive.content;val channel="private-print-device.${deviceUuid()?:return}";val auth=api.channelAuth(socketId,channel)["auth"]!!.jsonPrimitive.content;ws.send(buildJsonObject{put("event","pusher:subscribe");put("data",buildJsonObject{put("auth",auth);put("channel",channel)})}.toString());onState(true);onWake()}
        "pusher:ping"->ws.send("{\"event\":\"pusher:pong\",\"data\":{}}")
        "print.job.available"->onWake()
    }}
    private fun retry(){if(!running.get())return;scope.launch{delay((1000L shl attempt.coerceAtMost(5))+kotlin.random.Random.nextLong(500));attempt++;connect()}}
}
