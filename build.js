const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('  AL-MANAR UNIVERSITY COLLEGE — HARDENED BUILD PIPELINE');
console.log('====================================================');

// 1. Dependency Pre-check (ensure vite is installed for frontend build)
let viteExists = false;
try {
  if (fs.existsSync(path.join(__dirname, 'node_modules/vite')) || 
      fs.existsSync(path.join(__dirname, 'frontend/node_modules/vite')) ||
      fs.existsSync(path.join(__dirname, 'node_modules/.bin/vite'))) {
    viteExists = true;
  }
} catch (e) {
  // ignore check error
}

if (!viteExists) {
  console.log('[BUILD] vite not found. Installing workspace dependencies...');
  try {
    execSync('npm install --include=dev', { stdio: 'inherit' });
  } catch (error) {
    console.error('[BUILD] FATAL ERROR: Root npm install failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('[BUILD] Dependencies verified (vite present).');
}

// 2. Phase 1: Explicitly generate Prisma Client
console.log('\n[BUILD] Phase 1: Generating Prisma Client...');
try {
  execSync('cd backend && npx prisma generate', { stdio: 'inherit' });
  console.log('[BUILD] Phase 1 Complete: Prisma Client generated.');
} catch (error) {
  console.error('[BUILD] Phase 1 FATAL ERROR: Prisma Client generation failed:', error.message);
  process.exit(1);
}

// 3. Phase 2: Synchronize Database Schema using prisma db push (replaces fragile migrate deploy)
console.log('\n[BUILD] Phase 2: Synchronizing Database Schema (prisma db push)...');
try {
  execSync('cd backend && npx prisma db push --accept-data-loss', { stdio: 'inherit' });
  console.log('[BUILD] Phase 2 Complete: Database schema synchronized successfully.');
} catch (error) {
  console.error('[BUILD] Phase 2 FATAL ERROR: Database schema synchronization failed:', error.message);
  process.exit(1);
}

// 4. Phase 3: Seed database with initial Al-Manar University data
console.log('\n[BUILD] Phase 3: Seeding Database with Al-Manar University Data...');
try {
  execSync('cd backend && node prisma/seed.js', { stdio: 'inherit' });
  console.log('[BUILD] Phase 3 Complete: Database seeding completed successfully.');
} catch (error) {
  console.error('[BUILD] Phase 3 FATAL ERROR: Database seeding failed:', error.message);
  process.exit(1);
}

// 5. Phase 4: Compile Frontend Assets
if (!process.env.VITE_API_URL) {
  console.log('\n[BUILD] No VITE_API_URL provided. Frontend will resolve API endpoint dynamically at runtime.');
} else {
  console.log(`\n[BUILD] Using provided VITE_API_URL: ${process.env.VITE_API_URL}`);
}

console.log('[BUILD] Phase 4: Building Frontend Production Assets...');
try {
  execSync('cd frontend && npm run build', { stdio: 'inherit' });
  console.log('[BUILD] Phase 4 Complete: Frontend build completed successfully.');
} catch (error) {
  console.error('[BUILD] Phase 4 FATAL ERROR: Frontend build failed:', error.message);
  process.exit(1);
}

console.log('\n====================================================');
console.log('  BUILD PIPELINE COMPLETED SUCCESSFULLY (EXIT 0)');
console.log('====================================================');
