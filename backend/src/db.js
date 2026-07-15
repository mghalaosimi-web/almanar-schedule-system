const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

if (!global.pgPool) {
  const connectionString = process.env.DATABASE_URL;
  global.pgPool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 60000,          // Keep idle connections alive longer (remote DB)
    connectionTimeoutMillis: 20000,    // 20s — needed for Render.com cold starts
    allowExitOnIdle: false,            // Prevent pool from shutting down on idle
    ssl: { rejectUnauthorized: false }
  });

  // Keep-alive: ping the DB every 4 minutes to prevent Render's idle connection drops
  setInterval(async () => {
    try {
      const client = await global.pgPool.connect();
      await client.query('SELECT 1');
      client.release();
    } catch (e) {
      // Silently handled — fallback engine will take over if DB is truly down
    }
  }, 4 * 60 * 1000);

  global.pgPool.on('error', (err) => {
    console.error('[DATABASE] Unexpected error on idle pgPool client:', err.message);
  });
}

let prismaInstance;
if (!global.prismaRaw) {
  try {
    const adapter = new PrismaPg(global.pgPool);
    global.prismaRaw = new PrismaClient({ adapter });
  } catch (e) {
    console.error('[DATABASE] Failed to initialize raw PrismaClient:', e.message);
  }
}
prismaInstance = global.prismaRaw;

// Self-healing fallback state
if (global.isOfflineMode === undefined) {
  global.isOfflineMode = false;
}

const fallbackEngine = require('./utils/fallbackEngine');

function isDatabaseConnectionError(err) {
  if (!err) return false;
  
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toUpperCase();
  
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE', 'ECONNRESET'].includes(code)) {
    return true;
  }
  
  if (code.startsWith('P1')) {
    return true;
  }
  
  if (
    msg.includes('connection') ||
    msg.includes('connect') ||
    msg.includes('refused') ||
    msg.includes('timeout') ||
    msg.includes('pool') ||
    msg.includes('pg-pool') ||
    msg.includes('terminated') ||
    msg.includes('unreachable') ||
    msg.includes('econnrefused') ||
    msg.includes('ssl') ||
    msg.includes('socket') ||
    msg.includes('handshake')
  ) {
    return true;
  }

  const name = err.constructor?.name || '';
  if (name.includes('InitializationError') || name.includes('ConnectionError')) {
    return true;
  }
  
  return false;
}

if (!global.prisma) {
  global.prisma = new Proxy(prismaInstance || {}, {
    get(target, prop) {
      // Dynamically resolve target to active tenant-specific Prisma Client if available in context
      const { tenantDbStorage } = require('./utils/tenantContext');
      const activeTenantClient = tenantDbStorage.getStore();
      const currentTarget = activeTenantClient || target;

      if (typeof prop === 'string' && prop.startsWith('$')) {
        return async function (...args) {
          if (global.isOfflineMode && !activeTenantClient) {
            if (prop === '$connect' || prop === '$disconnect') return;
            if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
              return [{ '1': 1 }];
            }
            return;
          }
          try {
            return await currentTarget[prop](...args);
          } catch (err) {
            console.error(`[DATABASE ERROR] Prisma method ${prop} failed:`, err.message);
            if (!activeTenantClient) {
              global.isOfflineMode = true;
              console.warn('⚠️ DATABASE CONNECTION LOST: SWITCHING TO DYNAMIC FILESYSTEM FALLBACK ENGINE ⚠️');
              if (prop === '$queryRaw' || prop === '$queryRawUnsafe') {
                return [{ '1': 1 }];
              }
            } else {
              throw err;
            }
          }
        };
      }

      // Check if it's a model
      return new Proxy((currentTarget && currentTarget[prop]) || {}, {
        get(modelTarget, action) {
          if (typeof action !== 'string') return modelTarget[action];
          return async function (...args) {
            if (global.isOfflineMode && !activeTenantClient) {
              return fallbackEngine.execute(prop, action, args[0]);
            }
            try {
              return await modelTarget[action](...args);
            } catch (err) {
              if (isDatabaseConnectionError(err) && !activeTenantClient) {
                global.isOfflineMode = true;
                console.warn(`⚠️ DATABASE CONNECTION LOST DURING query: ${prop}.${action}. SWITCHING TO DYNAMIC FILESYSTEM FALLBACK ENGINE ⚠️`);
                return fallbackEngine.execute(prop, action, args[0]);
              }
              throw err;
            }
          };
        }
      });
    }
  });
}

const prisma = global.prisma;
const pgPool = global.pgPool;
const prismaRaw = prismaInstance;

module.exports = {
  prisma,
  pgPool,
  prismaRaw
};


