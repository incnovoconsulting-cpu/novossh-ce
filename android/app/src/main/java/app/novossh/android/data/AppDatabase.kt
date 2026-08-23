package app.novossh.android.data

import androidx.room.Database
import androidx.room.RoomDatabase
import app.novossh.android.models.Host
import app.novossh.android.models.IdentityKey
import app.novossh.android.models.PortForwarding
import app.novossh.android.models.SessionLog
import app.novossh.android.models.Snippet
import app.novossh.android.models.SnippetPackage
import app.novossh.android.models.Vault
import app.novossh.android.models.VaultEntry

@Database(
    entities = [Host::class, IdentityKey::class, Snippet::class, PortForwarding::class, SnippetPackage::class, SessionLog::class, Vault::class, VaultEntry::class],
    version = 4,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun hostDao(): HostDao
    abstract fun identityKeyDao(): KeyDao
    abstract fun snippetDao(): SnippetDao
    abstract fun portForwardingDao(): PortForwardingDao
    abstract fun snippetPackageDao(): SnippetPackageDao
    abstract fun sessionLogDao(): SessionLogDao
    abstract fun vaultDao(): VaultDao
}
