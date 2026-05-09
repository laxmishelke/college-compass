import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'collegeDB',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  multipleStatements: true,
  namedPlaceholders: false,
  decimalNumbers: true
};

console.log('[DB] MySQL config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  connectionLimit: dbConfig.connectionLimit
});

export const pool = mysql.createPool(dbConfig);

function getDatabaseErrorMessage(error) {
  if (error.code === 'ECONNREFUSED') {
    error.status = 503;
    return 'MySQL connection refused. Check that XAMPP MySQL is running on localhost:3306.';
  }

  if (error.code === 'ER_ACCESS_DENIED_ERROR') {
    error.status = 503;
    return 'MySQL authentication failed. Check DB_USER and DB_PASSWORD in your .env file.';
  }

  if (error.code === 'ER_BAD_DB_ERROR') {
    error.status = 503;
    return `MySQL database "${dbConfig.database}" does not exist. Create it in phpMyAdmin or run CREATE DATABASE first.`;
  }

  if (error.code === 'ER_NO_SUCH_TABLE') {
    error.status = 500;
    return 'Required database table is missing. Import db/schema.sql or run npm run db:migrate.';
  }

  return error.message;
}

export async function query(sql, params = []) {
  try {
    const [result] = params.length > 0
      ? await pool.execute(sql, params)
      : await pool.query(sql);

    const rows = Array.isArray(result) ? result : [];
    return {
      rows,
      rowCount: Array.isArray(result) ? result.length : result.affectedRows || 0,
      affectedRows: result.affectedRows || 0,
      insertId: result.insertId || 0,
      raw: result
    };
  } catch (error) {
    error.publicMessage = getDatabaseErrorMessage(error);
    console.error('MySQL query failed:', {
      message: error.message,
      code: error.code,
      sql
    });
    throw error;
  }
}

export async function testConnection() {
  const result = await query('SELECT NOW() AS connected_at');
  console.log('[DB] Connected to MySQL:', {
    database: dbConfig.database,
    connectedAt: result.rows[0].connected_at
  });
  return result;
}

export { dbConfig };
