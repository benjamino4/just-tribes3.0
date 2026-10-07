import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

export async function migrate() {
  const sql = fs.readFileSync('./schema.sql', 'utf8');
  await pool.query(sql);
  console.log('✓ Migration complete');
}

export const q = (text, params) => pool.query(text, params);