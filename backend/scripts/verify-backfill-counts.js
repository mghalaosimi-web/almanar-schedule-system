process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const userRes = await client.query('SELECT COUNT(*) FROM "User"');
  const pwdRes = await client.query('SELECT COUNT(*) FROM "PasswordCredential"');
  const authRes = await client.query('SELECT COUNT(*) FROM "AuthIdentity"');
  const roleRes = await client.query('SELECT COUNT(*) FROM "UserRole"');
  
  const studentLinked = await client.query('SELECT COUNT(*) FROM "Student" WHERE "userId" IS NOT NULL');
  const lecturerLinked = await client.query('SELECT COUNT(*) FROM "Lecturer" WHERE "userId" IS NOT NULL');
  const adminLinked = await client.query('SELECT COUNT(*) FROM "Admin" WHERE "userId" IS NOT NULL');

  console.log('=== POST-BACKFILL VERIFICATION ===');
  console.log(`Users in DB: ${userRes.rows[0].count}`);
  console.log(`PasswordCredentials in DB: ${pwdRes.rows[0].count}`);
  console.log(`AuthIdentities in DB: ${authRes.rows[0].count}`);
  console.log(`UserRoles in DB: ${roleRes.rows[0].count}`);
  console.log(`Linked Students: ${studentLinked.rows[0].count} / 1005`);
  console.log(`Linked Lecturers: ${lecturerLinked.rows[0].count} / 28`);
  console.log(`Linked Admins: ${adminLinked.rows[0].count} / 3`);

  await client.end();
}

run().catch(err => {
  console.error('Error in verification:', err);
  process.exit(1);
});
