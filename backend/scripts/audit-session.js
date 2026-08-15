process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function auditSession() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  console.log('=== USER SESSION READ-ONLY AUDIT ===\n');

  // Check FK constraint on UserSession -> User
  const fkRes = await client.query(`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'UserSession' AND constraint_type = 'FOREIGN KEY';
  `);
  console.log(`[UserSession Schema] Foreign Key constraints: ${fkRes.rows.map(r => r.constraint_name).join(', ')}`);

  // Check count of active / total sessions
  const countRes = await client.query('SELECT COUNT(*) FROM "UserSession"');
  console.log(`[UserSession Data] Total UserSession records: ${countRes.rows[0].count}`);

  await client.end();
}

auditSession().catch(err => {
  console.error('Session audit error:', err);
  process.exit(1);
});
