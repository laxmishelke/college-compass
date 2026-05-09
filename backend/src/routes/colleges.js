import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

const listFields = `
  id,
  name,
  slug,
  city,
  state,
  type,
  established_year,
  rating,
  acceptance_rate,
  annual_fees,
  average_package,
  image_url,
  courses
`;

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCollege(college) {
  if (!college) {
    return college;
  }

  return {
    ...college,
    courses: parseJsonArray(college.courses),
    facilities: parseJsonArray(college.facilities)
  };
}

function normalizeColleges(colleges) {
  return colleges.map(normalizeCollege);
}

async function ensureCollegesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS colleges (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(180) NOT NULL,
      slug VARCHAR(220) UNIQUE NOT NULL,
      city VARCHAR(100) NOT NULL,
      state VARCHAR(100) NOT NULL,
      type VARCHAR(60) NOT NULL,
      established_year INT NOT NULL,
      rating DECIMAL(2, 1) NOT NULL DEFAULT 0,
      acceptance_rate DECIMAL(5, 2),
      annual_fees INT NOT NULL,
      average_package INT,
      highest_package INT,
      description TEXT NOT NULL,
      website VARCHAR(255),
      image_url TEXT,
      courses JSON NOT NULL,
      facilities JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

router.get('/', async (req, res, next) => {
  try {
    await ensureCollegesTable();

    const {
      search = '',
      name = '',
      location = '',
      state = '',
      type = '',
      minFees = '',
      maxFees = ''
    } = req.query;
    const params = [];
    const filters = [];
    const nameSearch = String(name || search).trim();
    const locationSearch = String(location || state).trim();
    const hasMinFees = String(minFees).trim() !== '';
    const hasMaxFees = String(maxFees).trim() !== '';
    const minFeesValue = hasMinFees ? Number(minFees) : null;
    const maxFeesValue = hasMaxFees ? Number(maxFees) : null;

    if (nameSearch) {
      params.push(`%${nameSearch.toLowerCase()}%`);
      filters.push('LOWER(name) LIKE ?');
    }

    if (locationSearch) {
      const locationParam = `%${locationSearch.toLowerCase()}%`;
      params.push(locationParam, locationParam);
      filters.push('(LOWER(city) LIKE ? OR LOWER(state) LIKE ?)');
    }

    if (String(type).trim()) {
      params.push(String(type).trim());
      filters.push('type = ?');
    }

    if (hasMinFees && !Number.isFinite(minFeesValue)) {
      return res.status(400).json({ message: 'Minimum fees must be a valid number.' });
    }

    if (hasMaxFees && !Number.isFinite(maxFeesValue)) {
      return res.status(400).json({ message: 'Maximum fees must be a valid number.' });
    }

    if (hasMinFees && hasMaxFees && minFeesValue > maxFeesValue) {
      return res.status(400).json({ message: 'Minimum fees cannot be greater than maximum fees.' });
    }

    if (hasMinFees) {
      params.push(minFeesValue);
      filters.push('annual_fees >= ?');
    }

    if (hasMaxFees) {
      params.push(maxFeesValue);
      filters.push('annual_fees <= ?');
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const result = await query(
      `SELECT ${listFields}
       FROM colleges
       ${where}
       ORDER BY rating DESC, name ASC`,
      params
    );

    res.json({ colleges: normalizeColleges(result.rows) });
  } catch (error) {
    next(error);
  }
});

router.get('/compare', async (req, res, next) => {
  try {
    await ensureCollegesTable();

    const rawIds = String(req.query.ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const ids = [...new Set(rawIds.map((id) => Number(id)))];
    const hasInvalidId = rawIds.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0);

    if (hasInvalidId) {
      return res.status(400).json({ message: 'Provide valid college ids.' });
    }

    if (ids.length < 2 || ids.length > 3) {
      return res.status(400).json({ message: 'Select 2 or 3 colleges to compare.' });
    }

    const placeholders = ids.map(() => '?').join(', ');
    const result = await query(
      `SELECT *
       FROM colleges
       WHERE id IN (${placeholders})
       ORDER BY FIELD(id, ${placeholders})`,
      [...ids, ...ids]
    );

    if (result.rowCount !== ids.length) {
      return res.status(404).json({ message: 'One or more selected colleges were not found.' });
    }

    return res.json({ colleges: normalizeColleges(result.rows) });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    await ensureCollegesTable();

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid college id.' });
    }

    const result = await query('SELECT * FROM colleges WHERE id = ?', [id]);
    const college = normalizeCollege(result.rows[0]);

    if (!college) {
      return res.status(404).json({ message: 'College not found.' });
    }

    return res.json({ college });
  } catch (error) {
    return next(error);
  }
});

export default router;
