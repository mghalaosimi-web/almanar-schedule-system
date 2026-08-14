require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

client.connect().then(async () => {
  const groupsWithSchedules = await client.query('SELECT "groupId", COUNT(*) as cnt FROM "Schedule" GROUP BY "groupId" ORDER BY cnt DESC LIMIT 5');
  console.log('Top Groups with schedules:', groupsWithSchedules.rows);
  if (groupsWithSchedules.rows.length > 0) {
    const topGroupId = groupsWithSchedules.rows[0].groupId;
    await client.query('UPDATE "Student" SET "groupId" = $1 WHERE email = \'test1@almanar.edu.ye\'', [topGroupId]);
    console.log(`Updated test1@almanar.edu.ye to groupId ${topGroupId}`);
  }
  client.end();
}).catch(err => {
  console.error(err);
});
