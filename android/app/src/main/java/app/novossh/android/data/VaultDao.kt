package app.novossh.android.data

import androidx.room.*
import app.novossh.android.models.Vault
import app.novossh.android.models.VaultEntry
import kotlinx.coroutines.flow.Flow

@Dao
interface VaultDao {
    @Query("SELECT * FROM vaults ORDER BY updatedAt DESC")
    fun getAllVaults(): Flow<List<Vault>>

    @Query("SELECT * FROM vaults WHERE id = :id")
    fun getVaultById(id: String): Flow<Vault?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVault(vault: Vault): Long

    @Query("UPDATE vaults SET updatedAt = :updatedAt WHERE id = :vaultId")
    suspend fun updateVaultTimestamp(vaultId: String, updatedAt: Long)

    @Delete
    suspend fun deleteVault(vault: Vault)

    @Query("SELECT * FROM vault_entries WHERE vaultId = :vaultId ORDER BY name ASC")
    fun getEntriesForVault(vaultId: String): Flow<List<VaultEntry>>

    @Query("SELECT * FROM vault_entries WHERE id = :id")
    fun getEntryById(id: String): Flow<VaultEntry?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEntry(entry: VaultEntry): Long

    @Update
    suspend fun updateEntry(entry: VaultEntry)

    @Delete
    suspend fun deleteEntry(entry: VaultEntry)

    @Query("DELETE FROM vault_entries WHERE id = :id")
    suspend fun deleteEntryById(id: String)

    @Query("SELECT COUNT(*) FROM vault_entries WHERE vaultId = :vaultId")
    suspend fun getEntryCount(vaultId: String): Int
}
