package app.novossh.android

import android.app.Application
import android.util.Log
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import app.novossh.android.data.AppDatabase
import app.novossh.android.data.SecureStorage
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase

class NovoSSHApp : Application() {
    companion object {
        private const val TAG = "NovoSSHApp"

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                try {
                    db.execSQL("""
                        CREATE TABLE IF NOT EXISTS port_forwards (
                            id TEXT PRIMARY KEY NOT NULL,
                            hostId TEXT NOT NULL,
                            label TEXT NOT NULL,
                            type TEXT NOT NULL,
                            localPort INTEGER NOT NULL,
                            remoteHost TEXT NOT NULL,
                            remotePort INTEGER NOT NULL,
                            status TEXT NOT NULL,
                            createdAt INTEGER NOT NULL
                        )
                    """.trimIndent())
                    Log.d(TAG, "Migration 1->2: port_forwards table created successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Migration 1->2 failed: ${e.message}", e)
                    throw e
                }
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                try {
                    db.execSQL("ALTER TABLE hosts ADD COLUMN identityId TEXT")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN jumpHostIds TEXT DEFAULT ''")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN proxyType TEXT DEFAULT 'NONE'")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN proxyHost TEXT")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN proxyPort INTEGER")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN proxyUsername TEXT")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN proxyPasswordRef TEXT")
                    db.execSQL("ALTER TABLE hosts ADD COLUMN startupSnippetId TEXT")
                    db.execSQL("ALTER TABLE snippets ADD COLUMN packageId TEXT")
                    db.execSQL("""
                        CREATE TABLE IF NOT EXISTS snippet_packages (
                            id TEXT PRIMARY KEY NOT NULL,
                            label TEXT NOT NULL,
                            createdAt INTEGER NOT NULL
                        )
                    """.trimIndent())
                    db.execSQL("""
                        CREATE TABLE IF NOT EXISTS session_logs (
                            id TEXT PRIMARY KEY NOT NULL,
                            hostId TEXT NOT NULL,
                            hostLabel TEXT NOT NULL,
                            startedAt INTEGER NOT NULL,
                            endedAt INTEGER,
                            commandCount INTEGER NOT NULL DEFAULT 0,
                            bookmarked INTEGER NOT NULL DEFAULT 0,
                            bookmarkComment TEXT
                        )
                    """.trimIndent())
                    Log.d(TAG, "Migration 2->3: new columns and tables created successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "Migration 2->3 failed: ${e.message}", e)
                    throw e
                }
            }
        }
    }

    private val MIGRATION_3_4 = object : Migration(3, 4) {
        override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
            try {
                Log.d(TAG, "Migration 3->4: creating vaults and vault_entries tables")
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS vaults (
                        id TEXT PRIMARY KEY NOT NULL,
                        name TEXT NOT NULL,
                        description TEXT,
                        createdAt INTEGER NOT NULL,
                        updatedAt INTEGER NOT NULL
                    )
                """.trimIndent())
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS vault_entries (
                        id TEXT PRIMARY KEY NOT NULL,
                        vaultId TEXT NOT NULL,
                        type TEXT NOT NULL,
                        name TEXT NOT NULL,
                        encryptedData TEXT NOT NULL,
                        createdAt INTEGER NOT NULL,
                        updatedAt INTEGER NOT NULL,
                        FOREIGN KEY (vaultId) REFERENCES vaults(id) ON DELETE CASCADE
                    )
                """.trimIndent())
                Log.d(TAG, "Migration 3->4: vault tables created successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Migration 3->4 failed: ${e.message}", e)
                throw e
            }
        }
    }

    val database: AppDatabase by lazy {
        try {
            Log.d(TAG, "Initializing database...")
            val db = Room.databaseBuilder(this, AppDatabase::class.java, "novossh.db")
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
                .fallbackToDestructiveMigrationOnDowngrade()
                .build()
            Log.d(TAG, "Database initialized successfully")
            db
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize database: ${e.message}", e)
            throw e
        }
    }

    val secureStorage: SecureStorage by lazy {
        try {
            Log.d(TAG, "Initializing secure storage...")
            val storage = SecureStorage(this)
            Log.d(TAG, "Secure storage initialized successfully")
            storage
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize secure storage: ${e.message}", e)
            throw e
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "NovoSSH App starting...")
        try {
            // Initialize Firebase Crashlytics
            Firebase.crashlytics.setCrashlyticsCollectionEnabled(true)
            Log.d(TAG, "Firebase Crashlytics initialized")

            // Enable analytics (advertising ID removed via manifest)
            Firebase.analytics.setAnalyticsCollectionEnabled(true)

            // Pre-initialize database and storage to catch errors early
            val dbInstance = database
            val storageInstance = secureStorage
            Log.d(TAG, "App initialization successful")
        } catch (e: Exception) {
            Log.e(TAG, "Critical app initialization error: ${e.message}", e)
        }
    }
}
