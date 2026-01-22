import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import path from 'path';

const dbType = process.env.DB_TYPE || 'sqlite';

// SQLite Database (for development)
let sqliteDb: sqlite3.Database | null = null;

if (dbType === 'sqlite') {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../feedback.db');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
    } else {
      console.log('✅ Connected to SQLite database');
    }
  });
}

// PostgreSQL Pool (for production)
let pgPool: Pool | null = null;

if (dbType === 'postgres') {
  pgPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pgPool.on('connect', () => {
    console.log('✅ Connected to PostgreSQL database');
  });

  pgPool.on('error', (err: Error) => {
    console.error('PostgreSQL pool error:', err);
  });
}

// Unified query interface
export const query = async (sql: string, params: any[] = []): Promise<any> => {
  if (dbType === 'sqlite' && sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  } else if (dbType === 'postgres' && pgPool) {
    const result = await pgPool.query(sql, params);
    return result.rows;
  }
  throw new Error('No database connection available');
};

export const run = async (sql: string, params: any[] = []): Promise<any> => {
  if (dbType === 'sqlite' && sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  } else if (dbType === 'postgres' && pgPool) {
    const result = await pgPool.query(sql, params);
    return { lastID: result.rows[0]?.id, changes: result.rowCount };
  }
  throw new Error('No database connection available');
};

export const get = async (sql: string, params: any[] = []): Promise<any> => {
  if (dbType === 'sqlite' && sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  } else if (dbType === 'postgres' && pgPool) {
    const result = await pgPool.query(sql, params);
    return result.rows[0];
  }
  throw new Error('No database connection available');
};

export const close = async (): Promise<void> => {
  if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb!.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } else if (pgPool) {
    await pgPool.end();
  }
};

export default { query, run, get, close };

