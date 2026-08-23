package app.novossh.android.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import app.novossh.android.models.SnippetPackage
import kotlinx.coroutines.flow.Flow

@Dao
interface SnippetPackageDao {
    @Query("SELECT * FROM snippet_packages ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<SnippetPackage>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(pkg: SnippetPackage)

    @Query("DELETE FROM snippet_packages WHERE id = :id")
    suspend fun delete(id: String)
}
