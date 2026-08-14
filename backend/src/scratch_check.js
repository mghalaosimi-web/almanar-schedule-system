require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(async () => {
  const r = await c.query("SELECT email, \"idNumber\", password IS NOT NULL as has_pass FROM \"Student\" WHERE email LIKE 'test%' LIMIT 5");
  console.log('Test students in Supabase:');
  console.log(JSON.stringify(r.rows, null, 2));
  const admins = await c.query('SELECT email, role FROM "Admin" LIMIT 5');
  console.log('Admins:', JSON.stringify(admins.rows, null, 2));
  const counts = await c.query('SELECT (SELECT COUNT(*) FROM "Student") as students, (SELECT COUNT(*) FROM "Schedule") as schedules');
  console.log('Counts:', JSON.stringify(counts.rows[0], null, 2));
  c.end();
}).catch(e => { console.error('Error:', e.message); });
