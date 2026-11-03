import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
export const ensureDbDirectory = (dbPath: string = config.DB_PATH): void => {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
};
ensureDbDirectory();

// Open SQLite database with busy_timeout and WAL mode using native Node.js DatabaseSync
export const db = new DatabaseSync(config.DB_PATH);
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA cache_size = -64000;');

// Initialize schema
const schemaPath = path.resolve(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

// Runtime migration safeguard: ensure preferences column exists in users table
export const runPreferencesMigration = (targetDb: any = db): void => {
  try {
    const tableInfo = targetDb.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
    const hasPreferences = tableInfo.some((col) => col.name === 'preferences');
    if (!hasPreferences) {
      targetDb.exec("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}';");
    }
  } catch (err) {
    console.error('[Database] Migration error while verifying preferences column:', err);
  }
};
runPreferencesMigration(db);

export default db;
