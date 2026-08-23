package app.novossh.android.data

import androidx.room.*
import app.novossh.android.models.Host
import kotlinx.coroutines.flow.Flow

@Dao
interface HostDao {
    @Query("SELECT * FROM hosts ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<Host>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(host: Host)

    @Update
    suspend fun update(host: Host)

    @Query("DELETE FROM hosts WHERE id = :id")
    suspend fun delete(id: String)

    @Query("UPDATE hosts SET lastConnectedAt = :time WHERE id = :id")
    suspend fun touch(id: String, time: Long = System.currentTimeMillis())
}
