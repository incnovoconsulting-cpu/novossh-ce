package app.novossh.android.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import app.novossh.android.models.PortForwarding
import kotlinx.coroutines.flow.Flow

@Dao
interface PortForwardingDao {
    @Insert
    suspend fun insert(portForwarding: PortForwarding)

    @Update
    suspend fun update(portForwarding: PortForwarding)

    @Delete
    suspend fun delete(portForwarding: PortForwarding)

    @Query("SELECT * FROM port_forwards WHERE id = :id")
    fun getById(id: String): Flow<PortForwarding?>

    @Query("SELECT * FROM port_forwards WHERE hostId = :hostId")
    fun getByHostId(hostId: String): Flow<List<PortForwarding>>

    @Query("SELECT * FROM port_forwards ORDER BY createdAt DESC")
    fun getAll(): Flow<List<PortForwarding>>

    @Query("DELETE FROM port_forwards WHERE hostId = :hostId")
    suspend fun deleteByHostId(hostId: String)
}
