import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { SEED_FOODS } from './seed-foods';

// Ensure data directory exists (on Vercel serverless use writable /tmp)
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const dataDir = isVercel ? '/tmp' : path.join(process.cwd(), 'data');

if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    // Ignore if directory exists or cannot be created
  }
}

const dbPath = path.join(dataDir, 'nutritrack.db');

// If running on Vercel /tmp and DB doesn't exist yet, copy initial seed DB if present
if (isVercel && !fs.existsSync(dbPath)) {
  const localDb = path.join(process.cwd(), 'data', 'nutritrack.db');
  if (fs.existsSync(localDb)) {
    try {
      fs.copyFileSync(localDb, dbPath);
    } catch (err) {
      console.warn('Could not copy initial DB to /tmp, will initialize fresh:', err);
    }
  }
}

// Singleton database instance
let database: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (database) return database;

  database = new DatabaseSync(dbPath);
  database.exec('PRAGMA foreign_keys = ON;');
  try {
    database.exec('PRAGMA journal_mode = WAL;');
  } catch (err) {
    // WAL mode may be unsupported on some serverless /tmp filesystems
  }

  initSchema(database);
  seedInitialData(database);

  return database;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otps (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      height_cm REAL NOT NULL,
      weight_kg REAL NOT NULL,
      activity_level TEXT NOT NULL,
      fitness_goal TEXT NOT NULL,
      daily_step_goal INTEGER DEFAULT 10000,
      calorie_target INTEGER NOT NULL,
      protein_target INTEGER NOT NULL,
      carb_target INTEGER NOT NULL,
      fat_target INTEGER NOT NULL,
      fibre_target INTEGER NOT NULL,
      water_target INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS food_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      calories_per_100g REAL NOT NULL,
      protein_per_100g REAL NOT NULL,
      carbs_per_100g REAL NOT NULL,
      fat_per_100g REAL NOT NULL,
      fibre_per_100g REAL NOT NULL,
      serving_unit_default TEXT NOT NULL,
      serving_weight_grams REAL NOT NULL,
      is_discretionary INTEGER NOT NULL DEFAULT 0,
      icon TEXT NOT NULL DEFAULT '🍽️',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);
    CREATE INDEX IF NOT EXISTS idx_food_items_category ON food_items(category);

    CREATE TABLE IF NOT EXISTS daily_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL, -- YYYY-MM-DD
      steps INTEGER DEFAULT 0,
      is_submitted INTEGER DEFAULT 0,
      submitted_at TEXT,
      goal_completion_pct INTEGER,
      remarks_json TEXT,
      calorie_target_snapshot INTEGER,
      protein_target_snapshot INTEGER,
      carb_target_snapshot INTEGER,
      fat_target_snapshot INTEGER,
      fibre_target_snapshot INTEGER,
      water_target_snapshot INTEGER,
      step_target_snapshot INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, date);

    CREATE TABLE IF NOT EXISTS food_entries (
      id TEXT PRIMARY KEY,
      daily_log_id TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      food_item_id TEXT,
      custom_name TEXT NOT NULL,
      portion_amount REAL NOT NULL,
      portion_unit TEXT NOT NULL,
      computed_weight_g REAL NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fibre REAL NOT NULL,
      is_discretionary INTEGER NOT NULL DEFAULT 0,
      icon TEXT DEFAULT '🍽️',
      created_at TEXT NOT NULL,
      FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_food_entries_log ON food_entries(daily_log_id);

    CREATE TABLE IF NOT EXISTS water_entries (
      id TEXT PRIMARY KEY,
      daily_log_id TEXT NOT NULL,
      amount_ml INTEGER NOT NULL,
      logged_at TEXT NOT NULL,
      FOREIGN KEY (daily_log_id) REFERENCES daily_logs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_water_entries_log ON water_entries(daily_log_id);

    CREATE TABLE IF NOT EXISTS weight_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, date);
  `);
}

function seedInitialData(db: DatabaseSync) {
  const insertStmt = db.prepare(`
    INSERT INTO food_items (
      id, name, category, calories_per_100g, protein_per_100g, carbs_per_100g,
      fat_per_100g, fibre_per_100g, serving_unit_default, serving_weight_grams,
      is_discretionary, icon, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const checkStmt = db.prepare('SELECT id FROM food_items WHERE name = ? LIMIT 1');
  const now = new Date().toISOString();

  for (const food of SEED_FOODS) {
    const existing = checkStmt.get(food.name);
    if (!existing) {
      const id = 'food_' + Math.random().toString(36).substring(2, 11);
      insertStmt.run(
        id,
        food.name,
        food.category,
        food.calories_per_100g,
        food.protein_per_100g,
        food.carbs_per_100g,
        food.fat_per_100g,
        food.fibre_per_100g,
        food.serving_unit_default,
        food.serving_weight_grams,
        food.is_discretionary ? 1 : 0,
        food.icon,
        now
      );
    }
  }
}
