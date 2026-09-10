// PostgreSQL Database Connection & Query Runner
// Supports Neon, Supabase, Cloud SQL, and self-hosted PostgreSQL via DATABASE_URL
// Falls back to an in-memory PostgreSQL engine (pg-mem) for instant local/preview testing

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool;
let isInMemory = false;

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl && databaseUrl.trim() !== '') {
  console.log('Connecting to PostgreSQL via DATABASE_URL...');
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });
} else {
  console.log('ℹ️  No DATABASE_URL environment variable provided. Initializing in-memory PostgreSQL emulator (pg-mem) for development...');
  isInMemory = true;
  const { newDb } = await import('pg-mem');
  const memDb = newDb();

  try {
    const schemaPath = path.join(process.cwd(), 'db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      memDb.public.none(schemaSql);
      console.log('In-memory PostgreSQL schema applied.');
    }

    const seedPath = path.join(process.cwd(), 'db/seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      memDb.public.none(seedSql);
      console.log('In-memory PostgreSQL seed data applied.');
    }
  } catch (err) {
    console.error('Error applying schema/seed to in-memory PostgreSQL:', err);
  }

  const PgPool = memDb.adapters.createPg().Pool;
  pool = new PgPool();
}

// Auto-run schema migrations on real Postgres if connected
let initialized = false;
export async function initDb() {
  if (initialized) return;
  initialized = true;

  if (!isInMemory && pool) {
    try {
      const schemaPath = path.join(process.cwd(), 'db/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('PostgreSQL tables and constraints verified/created.');
      }
    } catch (err) {
      console.error('Schema initialization notice:', err.message);
    }
  }
}

// Helper query function with parameter binding
export async function query(text, params) {
  await initDb();
  return pool.query(text, params);
}

export function getPool() {
  return pool;
}

export function isDbInMemory() {
  return isInMemory;
}
