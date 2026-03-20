import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.V2_DB_PATH || path.join(process.cwd(), 'logistics_v2.db');

let v2Db: Database.Database | null = null;

export function getV2Db(): Database.Database {
  if (!v2Db) {
    v2Db = new Database(DB_PATH);
    v2Db.pragma('foreign_keys = ON');
    v2Db.pragma('busy_timeout = 5000');
  }
  return v2Db;
}

export function closeV2Db(): void {
  if (v2Db) {
    v2Db.close();
    v2Db = null;
  }
}

export function getV2DbPath(): string {
  return DB_PATH;
}
