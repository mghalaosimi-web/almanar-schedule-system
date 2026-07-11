require('dotenv').config();

// Environment Validation Check
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('CRITICAL CONFIGURATION ERROR: Missing required environment variables (DATABASE_URL and JWT_SECRET).');
  process.exit(1);
}

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const webpush = require('web-push');

// Database configuration singleton
const { prisma } = require('./db');

// Services
const { initializeCronJobs } = require('./services/cron');

// Routers
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const studentRouter = require('./routes/student');
const lecturerRouter = require('./routes/lecturer');
const publicRouter = require('./routes/public');
const representativeRouter = require('./routes/representative');
const exchangeRouter = require('./routes/exchange');
const databaseRouter = require('./routes/database');
const { activityLogger } = require('./middleware/activityLogger');

const app = express();

// Configure Helmet with permissive CSP and COOP/COEP for Google Sign-In and API requests
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com/gsi/client"],
      scriptSrcAttr: ["'unsafe-inline'"],
      frameSrc: ["'self'", "https://accounts.google.com/gsi/"],
      connectSrc: ["'self'", "https://accounts.google.com/gsi/", "https://*.googleapis.com", "https://content.googleapis.com", "*"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://lh3.googleusercontent.com", "*"],
    }
  },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  crossOriginEmbedderPolicy: false
}));

// VAPID Key Security — keys must always come from environment variables
// PRIVATE_VAPID_KEY must NEVER be hardcoded. In production, missing keys halt the server.
if (!process.env.PRIVATE_VAPID_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] CRITICAL: PRIVATE_VAPID_KEY environment variable is not set. Refusing to start in production without it.');
    process.exit(1);
  } else {
    console.warn('[PUSH] WARNING: PRIVATE_VAPID_KEY is not set. Push notifications will be disabled in this session.');
  }
}

if (!process.env.PUBLIC_VAPID_KEY) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] CRITICAL: PUBLIC_VAPID_KEY environment variable is not set. Refusing to start in production without it.');
    process.exit(1);
  } else {
    console.warn('[PUSH] WARNING: PUBLIC_VAPID_KEY is not set. Push notifications will be disabled in this session.');
  }
}

if (process.env.PUBLIC_VAPID_KEY && process.env.PRIVATE_VAPID_KEY) {
  webpush.setVapidDetails(
    'mailto:m.gh.alosimi@gmail.com',
    process.env.PUBLIC_VAPID_KEY,
    process.env.PRIVATE_VAPID_KEY
  );
  console.log('[PUSH] VAPID keys loaded successfully from environment variables.');
}

// Explicit CORS allowlist — never use wildcard(*) on a multi-tenant auth API
const ALLOWED_ORIGINS = [
  'https://manar-schedule-system.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:3000',
  ...(process.env.EXTRA_CORS_ORIGINS
    ? process.env.EXTRA_CORS_ORIGINS.split(',').map(o => o.trim())
    : [])
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Capacitor native)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    console.warn('[CORS] Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(activityLogger);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Manar Schedule System Backend is running.' });
});

// Register modular routers
app.use('/api/auth', authRouter);
app.use('/api', adminRouter);
app.use('/api', studentRouter);
app.use('/api', lecturerRouter);
app.use('/api/public', publicRouter);
app.use('/api/rep', representativeRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api', databaseRouter);

// NOTE: Database schema checks and startup migrations are handled via standard Prisma migrations (npx prisma migrate deploy) to avoid schema conflicts.

// Database startup, migrations, seeding, and port binding sequencing
async function boot() {
  try {
    console.log('[DATABASE] Connecting to PostgreSQL via Prisma Client...');
    await prisma.$connect();
    console.log('[DATABASE] Connected to PostgreSQL via Prisma Client.');

    // Check if seeding is needed (e.g. if university table is empty)
    try {
      const uniCount = await prisma.university.count();
      if (uniCount === 0) {
        console.log('[DATABASE] Warning: University table is empty. If this is a fresh setup, please run the seed script manually: node backend/prisma/seed.js');
      } else {
        console.log(`[DATABASE] Database populated with ${uniCount} universities.`);
      }
    } catch (dbErr) {
      console.warn('[DATABASE] Connection check warning:', dbErr.message);
    }

    // Initialize cron summary engine
    initializeCronJobs();

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log('Smart Notification Engine (Cron) is initialized.');
    });
  } catch (err) {
    console.error('[DATABASE] Critical database connection error:', err.message);
    process.exit(1);
  }
}

boot();

// ==========================================
// STATIC SERVING & ROUTING FOR SPA
// ==========================================

// Serve static files from the React frontend app build directory
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Handle invalid API routes without wildcards
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

// Static Catch-all middleware for client routing (Express 5 safe) wildcards
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  } else {
    next();
  }
});

// ==========================================
// GLOBAL ERROR HANDLING MIDDLEWARE
// ==========================================
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);

  // Catch ENOENT (File Not Found) errors for missing static assets
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  }

  // Fallback for non-API requests
  res.status(500).sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
