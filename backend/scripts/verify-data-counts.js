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

  const studentRes = await client.query('SELECT COUNT(*) FROM "Student"');
  const lecturerRes = await client.query('SELECT COUNT(*) FROM "Lecturer"');
  const adminRes = await client.query('SELECT COUNT(*) FROM "Admin"');

  const studentCount = parseInt(studentRes.rows[0].count, 10);
  const lecturerCount = parseInt(lecturerRes.rows[0].count, 10);
  const adminCount = parseInt(adminRes.rows[0].count, 10);

  console.log('--- PRODUCTION RECORD COUNTS ---');
  console.log(`Student: ${studentCount} (Required: 1005)`);
  console.log(`Lecturer: ${lecturerCount} (Required: 28)`);
  console.log(`Admin: ${adminCount} (Required: 3)`);

  await client.end();

  if (studentCount === 1005 && lecturerCount === 28 && adminCount === 3) {
    console.log('\n✅ DATA PRESERVATION = PASS');
    process.exit(0);
  } else {
    console.error('\n❌ DATA PRESERVATION = FAIL');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Error during count verification:', err);
  process.exit(1);
});
