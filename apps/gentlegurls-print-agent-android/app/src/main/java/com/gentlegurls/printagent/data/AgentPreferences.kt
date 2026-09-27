package com.gentlegurls.printagent.data
import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.map
private val Context.dataStore by preferencesDataStore("print_agent_settings")
data class DeviceIdentity(val uuid:String,val name:String,val branch:String)
class AgentPreferences(private val context:Context){
    private val uuid=stringPreferencesKey("device_uuid");private val name=stringPreferencesKey("device_name");private val branch=stringPreferencesKey("branch_name")
    val identity=context.dataStore.data.map{p->p[uuid]?.let{DeviceIdentity(it,p[name].orEmpty(),p[branch].orEmpty())}}
    suspend fun save(value:DeviceIdentity)=context.dataStore.edit{it[uuid]=value.uuid;it[name]=value.name;it[branch]=value.branch}
    suspend fun clear()=context.dataStore.edit{it.clear()}
}
