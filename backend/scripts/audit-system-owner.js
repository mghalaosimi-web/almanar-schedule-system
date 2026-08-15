process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function auditOwner() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const query = `
    SELECT 
      u.id AS user_id, 
      u.email, 
      u."emailNormalized", 
      r.key AS role_key,
      a.id AS admin_id,
      l.id AS lecturer_id,
      s.id AS student_id,
      (SELECT COUNT(*) FROM "PasswordCredential" pc WHERE pc."userId" = u.id) AS has_password_credential,
      (SELECT COUNT(*) FROM "AuthIdentity" ai WHERE ai."userId" = u.id) AS has_auth_identity
    FROM "User" u
    JOIN "UserRole" ur ON ur."userId" = u.id
    JOIN "Role" r ON r.id = ur."roleId"
    LEFT JOIN "Admin" a ON a."userId" = u.id
    LEFT JOIN "Lecturer" l ON l."userId" = u.id
    LEFT JOIN "Student" s ON s."userId" = u.id
    WHERE r.key = 'SYSTEM_OWNER';
  `;

  const res = await client.query(query);
  console.log('=== SYSTEM_OWNER ACCOUNTS IN PRODUCTION ===');
  console.log(JSON.stringify(res.rows, null, 2));

  await client.end();
}

auditOwner().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
