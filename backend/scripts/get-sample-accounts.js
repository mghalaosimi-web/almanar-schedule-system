process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function getSampleAccounts() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const admins = await client.query('SELECT name, email, role FROM "Admin" LIMIT 3');
  const lecturers = await client.query('SELECT name, email FROM "Lecturer" LIMIT 3');
  const students = await client.query('SELECT name, email, "idNumber", phone FROM "Student" LIMIT 3');

  console.log('=== ADMINS ===');
  console.log(admins.rows);
  console.log('=== LECTURERS ===');
  console.log(lecturers.rows);
  console.log('=== STUDENTS ===');
  console.log(students.rows);

  await client.end();
}

getSampleAccounts().catch(err => {
  console.error(err);
  process.exit(1);
});
