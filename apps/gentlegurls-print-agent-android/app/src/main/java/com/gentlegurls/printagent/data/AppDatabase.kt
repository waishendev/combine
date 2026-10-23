package com.gentlegurls.printagent.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName="jobs") data class LocalJob(@PrimaryKey val id:String,val type:String,val status:String,val message:String?,val updatedAt:Long=System.currentTimeMillis())
@Dao interface JobDao {
    @Query("SELECT * FROM jobs ORDER BY updatedAt DESC LIMIT 25") fun observe():Flow<List<LocalJob>>
    @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun save(job:LocalJob)
}
@Database(entities=[LocalJob::class],version=1,exportSchema=false) abstract class AppDatabase:RoomDatabase(){ abstract fun jobs():JobDao
    companion object { fun create(context:Context)=Room.databaseBuilder(context,AppDatabase::class.java,"print-agent.db").build() }
}
