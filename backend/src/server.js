import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import { testConnection } from './config/db.js';
import authRoutes from './routes/auth.js';
import collegeRoutes from './routes/colleges.js';
import savedCollegeRoutes from './routes/savedColleges.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const allowedOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use((req, _res, next) => {
  const safeBody = { ...req.body };
  if (safeBody.password) safeBody.password = '[hidden]';

  console.log(`[API] ${req.method} ${req.originalUrl}`, {
    query: req.query,
    body: safeBody
  });
  next();
});
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'college-compass-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/saved-colleges', savedCollegeRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, req, res, _next) => {
  console.error('API error:', error);
  res.status(error.status || 500).json({
    message: error.publicMessage || error.message || 'Something went wrong on the server.',
    code: error.code,
    path: req.originalUrl
  });
});

async function startServer() {
  try {
    console.log('[Server] Testing MySQL connection before startup...');
    await testConnection();

    app.listen(port, () => {
      console.log(`College Compass API running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start because MySQL is not connected:', {
      message: error.publicMessage || error.message,
      code: error.code
    });
    process.exit(1);
  }
}

startServer();
