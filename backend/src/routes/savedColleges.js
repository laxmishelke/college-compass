import express from 'express';
import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth);

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
  return {
    ...college,
    courses: parseJsonArray(college.courses),
    facilities: parseJsonArray(college.facilities)
  };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         c.*,
         sc.created_at AS saved_at
       FROM saved_colleges sc
       JOIN colleges c ON c.id = sc.college_id
       WHERE sc.user_id = ?
       ORDER BY sc.created_at DESC`,
      [req.user.id]
    );

    const colleges = result.rows.map(normalizeCollege);
    return res.json({
      colleges,
      savedIds: colleges.map((college) => college.id)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:collegeId', async (req, res, next) => {
  try {
    const collegeId = Number(req.params.collegeId);

    if (!Number.isInteger(collegeId) || collegeId <= 0) {
      return res.status(400).json({ message: 'Invalid college id.' });
    }

    const college = await query('SELECT id FROM colleges WHERE id = ?', [collegeId]);

    if (college.rowCount === 0) {
      return res.status(404).json({ message: 'College not found.' });
    }

    await query(
      `INSERT INTO saved_colleges (user_id, college_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [req.user.id, collegeId]
    );

    return res.status(201).json({ saved: true, collegeId });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:collegeId', async (req, res, next) => {
  try {
    const collegeId = Number(req.params.collegeId);

    if (!Number.isInteger(collegeId) || collegeId <= 0) {
      return res.status(400).json({ message: 'Invalid college id.' });
    }

    await query(
      'DELETE FROM saved_colleges WHERE user_id = ? AND college_id = ?',
      [req.user.id, collegeId]
    );

    return res.json({ saved: false, collegeId });
  } catch (error) {
    return next(error);
  }
});

export default router;
