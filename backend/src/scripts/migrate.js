import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool, query } from '../config/db.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(__dirname, '../../db');

async function runSqlFile(fileName) {
  const sql = await readFile(resolve(dbDir, fileName), 'utf8');
  await query(sql);
  console.log(`Applied ${fileName}`);
}

try {
  await runSqlFile('schema.sql');
  await runSqlFile('seed.sql');
  console.log('Database migration complete.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
