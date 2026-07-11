require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('--- RUNNING DB PRE-MIGRATION ACTIONS ---');
  
  // 1. Update legacy role values to SUPER_ADMIN to avoid locking out admin accounts
  try {
    await pool.query('UPDATE "Admin" SET "role" = \'SUPER_ADMIN\' WHERE "role" = \'ADMIN\'');
    console.log('Successfully updated legacy "ADMIN" roles to "SUPER_ADMIN" in database.');
  } catch (err) {
    console.log('No legacy ADMIN roles needed updating or table does not exist yet:', err.message);
  }

  // 2. Register new enum values in PostgreSQL type AdminRole if they do not exist
  try {
    await pool.query('ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS \'UNI_ADMIN\'');
    await pool.query('ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS \'COLLEGE_ADMIN\'');
    console.log('Successfully added "UNI_ADMIN" and "COLLEGE_ADMIN" to PostgreSQL enum "AdminRole".');
  } catch (err) {
    console.log('Altering type "AdminRole" issue or type does not exist:', err.message);
  }

  console.log('--- PRE-MIGRATION ACTIONS COMPLETE ---');
}

main()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error during pre-migration:', e);
    await pool.end();
    process.exit(1);
  });
