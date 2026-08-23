import postgres from 'postgres';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

let sql: postgres.Sql | null = null;

export const getDb = () => {
  if (!sql) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl && process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_URL must be set in production');
    }
    sql = postgres(dbUrl || 'postgres://localhost:5432/novossh');
  }
  return sql;
};

export const closeDb = async () => {
  if (sql) {
    await sql.end();
    sql = null;
  }
};

export const runMigrations = async () => {
  const db = getDb();
  const migrationsDir = join(process.cwd(), 'server', 'db', 'migrations');

  // Create migrations tracking table
  await db`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Get list of migration files sorted
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Skip already-applied migrations
    const already = await db`SELECT 1 FROM schema_migrations WHERE filename = ${file}`;
    if (already.length > 0) continue;

    console.log(`[migrations] Applying ${file}...`);
    try {
      await db.file(join(migrationsDir, file));
      await db`INSERT INTO schema_migrations (filename) VALUES (${file})`;
      console.log(`[migrations] Applied ${file}`);
    } catch (err: any) {
      // Skip "already exists" errors from IF NOT EXISTS
      if (err?.code === '42710' || err?.message?.includes('already exists')) {
        await db`INSERT INTO schema_migrations (filename) VALUES (${file}) ON CONFLICT DO NOTHING`;
        continue;
      }
      console.error(`[migrations] FAILED ${file}:`, err.message);
      // Throw on critical migration failures — server should not start with broken schema
      throw new Error(`Migration ${file} failed: ${err.message}`);
    }
  }

  console.log(`[migrations] Done — ${files.length} migrations checked`);
};
