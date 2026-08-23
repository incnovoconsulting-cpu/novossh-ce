package app.novossh.android.data

import androidx.room.*
import app.novossh.android.models.IdentityKey
import kotlinx.coroutines.flow.Flow

@Dao
interface KeyDao {
    @Query("SELECT * FROM identity_keys ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<IdentityKey>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(key: IdentityKey)

    @Query("DELETE FROM identity_keys WHERE id = :id")
    suspend fun delete(id: String)
}
