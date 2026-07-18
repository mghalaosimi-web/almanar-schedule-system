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
const authRouter = require('./routes/auth'); // → routes/auth/index.js
const adminRouter = require('./routes/admin');
const devPortalRouter = require('./routes/devPortal');
const studentRouter = require('./routes/student');
const lecturerRouter = require('./routes/lecturer');
const publicRouter = require('./routes/public');
const representativeRouter = require('./routes/representative');
const exchangeRouter = require('./routes/exchange');
const databaseRouter = require('./routes/database');
const goalsRouter = require('./routes/goals');

const { activityLogger } = require('./middleware/activityLogger');
const { requestLoggerMiddleware } = require('./middleware/requestLogger');
const { firewallMiddleware } = require('./middleware/firewall');
const { tenantDbMiddleware } = require('./middleware/tenantDb');

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
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// VAPID Key Security — keys must always come from environment variables
// PRIVATE_VAPID_KEY must NEVER be hardcoded. In production, missing keys halt the server.
if (!process.env.PRIVATE_VAPID_KEY) {
  console.warn('[PUSH] WARNING: PRIVATE_VAPID_KEY is not set. Push notifications will be disabled.');
}

if (!process.env.PUBLIC_VAPID_KEY) {
  console.warn('[PUSH] WARNING: PUBLIC_VAPID_KEY is not set. Push notifications will be disabled.');
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
  'https://almanar-schedule-system.onrender.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  'http://localhost:3000',
  ...(process.env.EXTRA_CORS_ORIGINS
    ? process.env.EXTRA_CORS_ORIGINS.split(',').map(o => o.trim())
    : [])
];

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  
  // Allow localhost/127.0.0.1 on any port in development/local environments
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  
  // Allow local network IP addresses (e.g. 192.168.x.x) for local testing
  if (/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
  
  // Allow Capacitor custom schemes
  if (origin.startsWith('capacitor://')) return true;
  if (origin.startsWith('chrome-extension://')) return true;
  
  return false;
}

app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.warn('[CORS] Blocked origin:', origin);
      callback(null, false); // Block securely without throwing/crashing Express with a 500 error
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(tenantDbMiddleware);
app.use(firewallMiddleware);
app.use(activityLogger);
app.use(requestLoggerMiddleware);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Manar Schedule System Backend is running.' });
});

// Register modular routers
app.use('/api/auth', authRouter);
app.use('/api', adminRouter);
app.use('/api', devPortalRouter);
app.use('/api', studentRouter);
app.use('/api', lecturerRouter);
app.use('/api/public', publicRouter);
app.use('/api/rep', representativeRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api', databaseRouter);
app.use('/api/goals', goalsRouter);

// Self-healing database check & migrations
async function runStartupMigrations() {
  try {
    console.log('[DATABASE] Running self-healing schema checks...');
    
    // Create enums if they don't exist
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdminRole') THEN
          CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');
        END IF;
      END$$;
    `).catch(() => { });

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VerificationType') THEN
          CREATE TYPE "VerificationType" AS ENUM ('EMAIL', 'PHONE');
        END IF;
      END$$;
    `).catch(() => { });

    // Create VerificationCode table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VerificationCode" (
        "id" SERIAL PRIMARY KEY,
        "studentId" INTEGER NOT NULL,
        "code" TEXT NOT NULL,
        "type" "VerificationType" NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL
      );
    `).catch(() => { });

    // Create BlockedIP table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "BlockedIP" (
        "id" SERIAL PRIMARY KEY,
        "ip" TEXT UNIQUE NOT NULL,
        "reason" TEXT,
        "blockedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `).catch(() => { });

    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "BlockedIP_ip_idx" ON "BlockedIP"("ip");').catch(() => { });

    // Ensure all dynamic columns exist
    await prisma.$executeRawUnsafe('ALTER TABLE "Admin" ADD COLUMN IF NOT EXISTS "role" "AdminRole" DEFAULT \'ADMIN\';').catch(() => { });
    await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "idNumber" TEXT;').catch(() => { });
    await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "idPhotoUrl" TEXT;').catch(() => { });
    await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "phone" TEXT;').catch(() => { });
    await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isEmailVerified" BOOLEAN DEFAULT false;').catch(() => { });
    await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "isPhoneVerified" BOOLEAN DEFAULT false;').catch(() => { });
    await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "password" TEXT;').catch(() => { });

    console.log('[DATABASE] Table schema fields migrated successfully.');

    // Check & add foreign key constraint if it doesn't exist
    const fkeyCheck = await prisma.$queryRawUnsafe(`
      SELECT conname FROM pg_constraint WHERE conname = 'VerificationCode_studentId_fkey'
    `);
    if (fkeyCheck.length === 0) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "VerificationCode" 
        ADD CONSTRAINT "VerificationCode_studentId_fkey" 
        FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE
      `).catch(() => { });
    }

    // Check & add unique constraints
    const idNumCheck = await prisma.$queryRawUnsafe(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'Student_idNumber_key' OR conname = 'Student_idNumber_unique'
    `);
    if (idNumCheck.length === 0) {
      console.log('[DATABASE] Adding unique constraint on Student.idNumber...');
      await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD CONSTRAINT "Student_idNumber_key" UNIQUE ("idNumber")').catch(() => { });
    }

    const phoneCheck = await prisma.$queryRawUnsafe(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname = 'Student_phone_key' OR conname = 'Student_phone_unique'
    `);
    if (phoneCheck.length === 0) {
      console.log('[DATABASE] Adding unique constraint on Student.phone...');
      await prisma.$executeRawUnsafe('ALTER TABLE "Student" ADD CONSTRAINT "Student_phone_key" UNIQUE ("phone")').catch(() => { });
    }

    console.log('[DATABASE] All database constraints checked/applied.');
  } catch (err) {
    console.warn('[DATABASE] Startup migration issue:', err.message);
  }
}

// Database startup, migrations, seeding, and port binding sequencing
async function boot() {
  try {
    console.log('[DATABASE] Connecting to PostgreSQL via Prisma Client...');
    await prisma.$connect();
    console.log('[DATABASE] Connected to PostgreSQL via Prisma Client.');

    // Commented out to prevent database lock contention across multi-tenant instances on boot
    // await runStartupMigrations();

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
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log('Smart Notification Engine (Cron) is initialized.');
    });

    // ── Graceful Shutdown ────────────────────────────────────────────────
    const shutdown = async (signal) => {
      console.log(`\n[SERVER] ${signal} received. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('[SERVER] HTTP server closed.');
        await prisma.$disconnect();
        console.log('[DATABASE] Prisma client disconnected cleanly.');
        process.exit(0);
      });
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('[SERVER] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
    // ────────────────────────────────────────────────────────────────────

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

  // Trigger self-healing patcher asynchronously for 500 Internal Server Errors
  const status = err.status || 500;
  if (status === 500) {
    const isDbError = err.message && (
      err.message.includes('Connection') ||
      err.message.includes('timeout') ||
      err.message.includes('pool') ||
      err.message.includes('Prisma') ||
      err.message.includes('pg-pool')
    );
    if (!isDbError) {
      try {
        const patcherService = require('./services/patcherService');
        patcherService.handleServerError(err, req);
      } catch (e) {
        console.error('[PatcherService] Failed to run handleServerError:', e);
      }
    }
  }

  // Catch ENOENT (File Not Found) errors for missing static assets
  if (err.code === 'ENOENT') {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  if (req.originalUrl && req.originalUrl.startsWith('/api/')) {
    const isProduction = process.env.NODE_ENV === 'production';
    return res.status(err.status || 500).json({
      success: false,
      error: isProduction ? 'Internal Server Error' : (err.message || 'Internal Server Error')
    });
  }

  // Fallback for non-API requests
  res.status(500).sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});
