import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS workshop_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('rule', 'character', 'scene', 'openingScene', 'preset')),
        content JSONB NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_avatar TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        reject_reason TEXT,
        created_at BIGINT NOT NULL,
        downloads INTEGER NOT NULL DEFAULT 0
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workshop_items_type_status 
      ON workshop_items(type, status);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workshop_items_created_at 
      ON workshop_items(created_at DESC);
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  return pool.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export default pool;
