package com.contentsync.app.core.database

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "cached_videos")
data class CachedVideoEntity(
    @PrimaryKey val id: String,
    val clientId: String,
    val clientName: String,
    val title: String,
    val description: String,
    val workflowStatus: String,
    val durationSeconds: Int,
    val sizeMb: Double,
    val dayOfWeek: Int,
    val plannedPublishAt: String
)

@Dao
interface CachedVideoDao {
    @Query("SELECT * FROM cached_videos ORDER BY plannedPublishAt DESC")
    fun observeAll(): Flow<List<CachedVideoEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<CachedVideoEntity>)

    @Query("DELETE FROM cached_videos")
    suspend fun clearAll()
}

@Database(
    entities = [CachedVideoEntity::class],
    version = 1,
    exportSchema = false
)
abstract class ContentSyncDatabase : RoomDatabase() {
    abstract fun cachedVideoDao(): CachedVideoDao
}
