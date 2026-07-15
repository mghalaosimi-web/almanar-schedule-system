const { PrismaClient } = require('@prisma/client');
const { prisma } = require('../db');

// LRU-capped cache: stores Prisma instances keyed by tenant DB URL.
// Max 10 simultaneous tenant clients — each holds its own pg connection pool.
// Oldest entry is disconnected and evicted when capacity is exceeded.
const MAX_TENANT_CLIENTS = 10;
const dbClients = new Map();

/**
 * Initializes and returns the global Prisma instance.
 */
function getGlobalPrisma() {
  return prisma;
}

/**
 * Returns a Prisma Client instance dynamically for a specific tenant.
 * Implements LRU eviction: when the cache exceeds MAX_TENANT_CLIENTS,
 * the oldest (first-inserted) entry is disconnected and removed.
 *
 * @param {string} overrideUrl - The custom database URL for the tenant.
 * @returns {PrismaClient}
 */
function getTenantPrisma(overrideUrl) {
  if (!overrideUrl) {
    return getGlobalPrisma();
  }

  // Cache hit — promote to most-recent by re-inserting
  if (dbClients.has(overrideUrl)) {
    const existing = dbClients.get(overrideUrl);
    dbClients.delete(overrideUrl);
    dbClients.set(overrideUrl, existing);
    return existing;
  }

  // Evict oldest entry when cap is reached
  if (dbClients.size >= MAX_TENANT_CLIENTS) {
    const oldestUrl = dbClients.keys().next().value;
    const oldestClient = dbClients.get(oldestUrl);
    dbClients.delete(oldestUrl);
    // Disconnect asynchronously — do not block the request
    oldestClient.$disconnect().catch((e) =>
      console.warn(`[DBFactory] Failed to cleanly disconnect evicted tenant client (${oldestUrl}):`, e.message)
    );
    console.log(`[DBFactory] LRU eviction: disconnected oldest tenant client. Cache size: ${MAX_TENANT_CLIENTS}`);
  }

  // Create and cache a new scoped Prisma Client for this tenant
  const tenantPrisma = new PrismaClient({
    datasources: {
      db: { url: overrideUrl },
    },
  });

  dbClients.set(overrideUrl, tenantPrisma);
  console.log(`[DBFactory] New tenant Prisma client created. Active clients: ${dbClients.size}/${MAX_TENANT_CLIENTS}`);

  return tenantPrisma;
}

/**
 * Disconnects and removes a tenant's Prisma instance from cache (e.g., when config changes).
 *
 * @param {string} overrideUrl
 */
async function cleanupTenantPrisma(overrideUrl) {
  if (dbClients.has(overrideUrl)) {
    const client = dbClients.get(overrideUrl);
    await client.$disconnect();
    dbClients.delete(overrideUrl);
    console.log(`[DBFactory] Tenant client disconnected and evicted. Active clients: ${dbClients.size}/${MAX_TENANT_CLIENTS}`);
  }
}

module.exports = {
  getGlobalPrisma,
  getTenantPrisma,
  cleanupTenantPrisma
};
