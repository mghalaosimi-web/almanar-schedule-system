const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

if (!global.pgPool) {
  const connectionString = process.env.DATABASE_URL;
  global.pgPool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Always use rejectUnauthorized: false for compatibility with Render database's self-signed certificate
    ssl: { rejectUnauthorized: false }
  });
}

if (!global.prisma) {
  const adapter = new PrismaPg(global.pgPool);
  global.prisma = new PrismaClient({ adapter });
}

const prisma = global.prisma;
const pgPool = global.pgPool;

module.exports = {
  prisma,
  pgPool
};
