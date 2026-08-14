require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect().then(async () => {
  const res = await client.query('UPDATE "Student" SET "googleId" = CONCAT(\'google_id_\', id) WHERE email LIKE \'test%\'');
  console.log('✅ Updated test students with googleId:', res.rowCount);
  client.end();
}).catch(err => {
  console.error('Error updating test students:', err);
});
