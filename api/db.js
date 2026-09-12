// PostgreSQL Database Connection & Query Runner
// Supports Neon, Supabase, Cloud SQL, and self-hosted PostgreSQL via DATABASE_URL
// Falls back to an in-memory PostgreSQL engine (pg-mem) for instant local/preview testing

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_SQL } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool;
let isInMemory = false;

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;

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
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  if (isProduction) {
    throw new Error(
      'CRITICAL DATABASE CONFIGURATION ERROR: Running in production environment (VERCEL or NODE_ENV=production) without a PostgreSQL connection string. ' +
      'In-memory databases cannot be used in production because serverless instances are stateless. ' +
      'Please set DATABASE_URL or POSTGRES_URL in your Vercel Project Settings > Environment Variables.'
    );
  }

  console.log('ℹ️  No DATABASE_URL environment variable provided. Initializing in-memory PostgreSQL emulator (pg-mem) for development...');
  isInMemory = true;
  const { newDb } = await import('pg-mem');
  const memDb = newDb();

  try {
    memDb.public.none(SCHEMA_SQL);
    console.log('In-memory PostgreSQL schema applied.');

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

// Auto-run schema migrations on real Postgres (e.g. Neon, Supabase) if connected
let isInitialized = false;
let initPromise = null;

export async function initDb() {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isInMemory && pool) {
      try {
        await pool.query(SCHEMA_SQL);
        console.log('PostgreSQL tables, foreign keys, and indexes verified/created successfully.');
        isInitialized = true;
      } catch (err) {
        console.error('PostgreSQL schema initialization error:', err.message);
        initPromise = null;
        throw err;
      }
    } else {
      isInitialized = true;
    }
  })();

  return initPromise;
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
