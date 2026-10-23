package com.gentlegurls.printagent
import android.Manifest
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.core.content.ContextCompat
import com.gentlegurls.printagent.service.PrintAgentService
import com.gentlegurls.printagent.ui.theme.GentlegurlsPrintAgentTheme
import kotlinx.coroutines.launch
class MainActivity:ComponentActivity(){override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);if(android.os.Build.VERSION.SDK_INT>=33)registerForActivityResult(ActivityResultContracts.RequestPermission()){}.launch(Manifest.permission.POST_NOTIFICATIONS);setContent{GentlegurlsPrintAgentTheme{AgentScreen((application as PrintAgentApplication).repository){ContextCompat.startForegroundService(this,Intent(this,PrintAgentService::class.java))}}}}}
@Composable fun AgentScreen(repo:AgentRepository,startService:()->Unit){val state by repo.state.collectAsStateWithLifecycle();val jobs by repo.jobs.collectAsStateWithLifecycle(emptyList());val scope=rememberCoroutineScope();var name by remember{mutableStateOf("")};var code by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)}
    Scaffold{padding->Column(Modifier.padding(padding).padding(24.dp).fillMaxSize(),verticalArrangement=Arrangement.spacedBy(16.dp)){Text("Gentlegurls Print Agent",style=MaterialTheme.typography.headlineMedium)
        if(state.identity==null){OutlinedTextField(name,{name=it},label={Text("Device Name")},modifier=Modifier.fillMaxWidth());OutlinedTextField(code,{code=it.uppercase()},label={Text("Pairing Code")},modifier=Modifier.fillMaxWidth());Button(enabled=!busy&&name.isNotBlank()&&code.isNotBlank(),onClick={busy=true;scope.launch{runCatching{repo.pair(name,code)}.onSuccess{startService()};busy=false}}){Text(if(busy)"Pairing…" else "Pair Device")}}
        else{val d=state.identity!!;Info("Branch",d.branch);Info("Device",d.name);Info("Connection",if(state.connected)"● Connected" else "● Reconnecting");Info("Print Agent",if(state.running)"● Running" else "● Stopped");Info("Last Heartbeat",state.lastHeartbeat?:"Waiting…");Button(onClick=startService){Text("Start Print Agent")};state.error?.let{Text(it,color=MaterialTheme.colorScheme.error)};Text("Recent Jobs",style=MaterialTheme.typography.titleLarge);LazyColumn{items(jobs){j->ListItem(headlineContent={Text(j.type.uppercase())},supportingContent={Text(j.message.orEmpty())},trailingContent={Text(j.status.replaceFirstChar(Char::uppercase))})}}}}
    }}
@Composable private fun Info(label:String,value:String){Column{Text(label,style=MaterialTheme.typography.labelMedium);Text(value,style=MaterialTheme.typography.titleMedium)}}
