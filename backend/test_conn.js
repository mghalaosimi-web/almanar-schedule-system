require('dotenv').config();
const { Client } = require('pg');

async function main() {
  console.log("Connecting with SSL rejectUnauthorized: false...");
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connection successful!");
    const res = await client.query('SELECT COUNT(*) FROM "Student"');
    console.log("Query result:", res.rows);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await client.end();
  }
}

main();
