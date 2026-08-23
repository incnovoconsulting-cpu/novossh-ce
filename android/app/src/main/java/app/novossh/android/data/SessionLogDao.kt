package app.novossh.android.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import app.novossh.android.models.SessionLog
import kotlinx.coroutines.flow.Flow

@Dao
interface SessionLogDao {
    @Query("SELECT * FROM session_logs ORDER BY startedAt DESC")
    fun observeAll(): Flow<List<SessionLog>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(log: SessionLog)

    @Query("UPDATE session_logs SET bookmarked = :bookmarked, bookmarkComment = :comment WHERE id = :id")
    suspend fun updateBookmark(id: String, bookmarked: Boolean, comment: String? = null)

    @Query("DELETE FROM session_logs WHERE id = :id")
    suspend fun delete(id: String)
}
