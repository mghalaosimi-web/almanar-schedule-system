const { execSync } = require('child_process');

// 1. Ensure all workspace dependencies and devDependencies are installed (skip if vite is already present to prevent out-of-memory crashes on free tiers)
const fs = require('fs');
const path = require('path');

let viteExists = false;
try {
  if (fs.existsSync(path.join(__dirname, 'node_modules/vite')) || 
      fs.existsSync(path.join(__dirname, 'frontend/node_modules/vite')) ||
      fs.existsSync(path.join(__dirname, 'node_modules/.bin/vite'))) {
    viteExists = true;
  }
} catch (e) {
  // ignore
}

if (!viteExists) {
  console.log('[BUILD] vite not found. Installing workspace dependencies (including devDependencies)...');
  try {
    execSync('npm install --include=dev', { stdio: 'inherit' });
  } catch (error) {
    console.warn('[BUILD] Root npm install warning:', error.message);
  }
} else {
  console.log('[BUILD] vite is already installed. Skipping npm install to save memory.');
}

// 2. Explicitly generate Prisma Client
console.log('[BUILD] Generating Prisma Client...');
try {
  execSync('cd backend && npx prisma generate', { stdio: 'inherit' });
} catch (error) {
  console.error('[BUILD] Prisma Client generation failed:', error.message);
  process.exit(1);
}

// 3. Construct VITE_API_URL if needed
if (!process.env.VITE_API_URL) {
  if (process.env.RENDER_EXTERNAL_URL) {
    process.env.VITE_API_URL = `${process.env.RENDER_EXTERNAL_URL}/api`;
    console.log(`[BUILD] Constructing VITE_API_URL from RENDER_EXTERNAL_URL: ${process.env.VITE_API_URL}`);
  } else {
    console.log('[BUILD] No VITE_API_URL or RENDER_EXTERNAL_URL provided. Frontend will resolve API endpoint dynamically in the browser.');
  }
} else {
  console.log(`[BUILD] Using provided VITE_API_URL: ${process.env.VITE_API_URL}`);
}

console.log('[BUILD] Starting frontend build...');

try {
  execSync('cd frontend && npm run build', { stdio: 'inherit' });
  console.log('[BUILD] Frontend build completed successfully.');
} catch (error) {
  console.error('[BUILD] Frontend build failed:', error.message);
  process.exit(1);
}
