package app.novossh.android.data

import androidx.room.*
import app.novossh.android.models.Snippet
import kotlinx.coroutines.flow.Flow

@Dao
interface SnippetDao {
    @Query("SELECT * FROM snippets ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<Snippet>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(snippet: Snippet)

    @Query("DELETE FROM snippets WHERE id = :id")
    suspend fun delete(id: String)
}
