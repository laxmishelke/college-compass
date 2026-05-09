import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth.js';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function ensureUsersTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const columns = await query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'users'`
  );
  const columnNames = columns.rows.map((row) => row.column_name);

  if (!columnNames.includes('password')) {
    //await query('ALTER TABLE users ADD COLUMN password TEXT');
  }

  if (columnNames.includes('password_hash')) {
    await query('ALTER TABLE users MODIFY password_hash TEXT NULL');
    await query('UPDATE users SET password = password_hash WHERE password IS NULL');
  }
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const trimmedName = String(name || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const rawPassword = String(password || '');

    if (!trimmedName || !normalizedEmail || !rawPassword) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ message: 'Enter a valid email address.' });
    }

    if (rawPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    await ensureUsersTable();

    const existing = await query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);

    if (existing.rowCount > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const created = await query(
      `INSERT INTO users (name, email, password)
       VALUES (?, ?, ?)`,
      [trimmedName, normalizedEmail, passwordHash]
    );
    const createdUser = await query('SELECT id, name, email FROM users WHERE id = ?', [created.insertId]);

    const user = createdUser.rows[0];
    return res.status(201).json({
      message: 'Account created successfully.',
      user: sanitizeUser(user),
      token: createToken(user)
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    return next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    await ensureUsersTable();

    const result = await query(
      'SELECT id, name, email, password FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    const user = result.rows[0];

    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({ user: sanitizeUser(user), token: createToken(user) });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query('SELECT id, name, email FROM users WHERE id = ?', [req.user.id]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'User account no longer exists.' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return next(error);
  }
});

export default router;
