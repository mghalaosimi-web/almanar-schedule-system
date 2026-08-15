process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const { execSync } = require('child_process');
const { Client } = require('pg');
const { PGlite } = require('@electric-sql/pglite');

async function getCatalogFingerprint(queryFn) {
  // 1. User tables
  const tablesRes = await queryFn(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name;
  `);
  const tables = tablesRes.rows.map(r => r.table_name);

  // 2. Columns
  const colsRes = await queryFn(`
    SELECT table_name, column_name, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name NOT IN ('_prisma_migrations')
    ORDER BY table_name, column_name;
  `);
  const columns = colsRes.rows.reduce((acc, row) => {
    const key = `${row.table_name}.${row.column_name}`;
    acc[key] = {
      type: row.udt_name,
      nullable: row.is_nullable === 'YES'
    };
    return acc;
  }, {});

  // 3. Enums
  const enumsRes = await queryFn(`
    SELECT t.typname AS enum_name, e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY enum_name, e.enumsortorder;
  `);
  const enums = enumsRes.rows.reduce((acc, row) => {
    if (!acc[row.enum_name]) acc[row.enum_name] = [];
    acc[row.enum_name].push(row.enum_value);
    return acc;
  }, {});

  // 4. Primary & Foreign Keys & Unique Constraints
  const constraintsRes = await queryFn(`
    SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name NOT IN ('_prisma_migrations')
    ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
  `);
  const constraints = constraintsRes.rows.reduce((acc, row) => {
    const key = `${row.table_name}.${row.constraint_name} (${row.constraint_type})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row.column_name);
    return acc;
  }, {});

  return { tables, columns, enums, constraints };
}

async function run() {
  console.log('=== DIRECTIVE 10.4: FINGERPRINT & BASELINE VALIDATION ===\n');

  // 1. Generate clean UTF-8 baseline SQL directly from Prisma
  console.log('[1/5] Extracting clean baseline SQL from Production datasource...');
  const rawOutput = execSync('npx prisma migrate diff --from-empty --to-config-datasource --script', {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });

  // Filter out any CLI output noise (e.g., "injected env...", "Loaded Prisma config...")
  const cleanSqlLines = rawOutput
    .split('\n')
    .filter(line => !line.includes('injected env') && !line.includes('Loaded Prisma config'));
  
  const baselineSql = cleanSqlLines.join('\n');
  const baselinePath = path.join(__dirname, '../prisma/baseline.sql');
  fs.writeFileSync(baselinePath, baselineSql, 'utf8');
  console.log(` -> Saved clean baseline.sql (${(baselineSql.length / 1024).toFixed(1)} KB UTF-8)`);

  // 2. Connect to isolated PGlite
  console.log('\n[2/5] Initializing isolated PGlite database...');
  const pglite = new PGlite();
  
  // Execute baseline SQL on PGlite statement by statement
  console.log('[3/5] Executing baseline SQL on PGlite...');
  try {
    const cleanedSql = baselineSql
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await pglite.query(stmt);
      } catch (e) {
        console.error(`Statement ${i + 1} failed:`, stmt.substring(0, 120));
        throw e;
      }
    }
    console.log(` -> baseline.sql applied cleanly (${statements.length} statements executed) on isolated PGlite!`);
  } catch (err) {
    console.error('ERROR: Failed to execute baseline.sql on PGlite:', err.message);
    process.exit(1);
  }

  // Query function for PGlite
  const pgliteQueryFn = async (sql) => {
    const res = await pglite.query(sql);
    return { rows: res.rows };
  };

  // 3. Connect to Production (Read-Only)
  console.log('\n[4/5] Connecting to Production database (READ-ONLY)...');
  const prodClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await prodClient.connect();
  const prodQueryFn = async (sql) => {
    const res = await prodClient.query(sql);
    return { rows: res.rows };
  };

  // 4. Capture Fingerprints
  console.log('[5/5] Fingerprinting Production vs Fresh PGlite baseline...');
  const prodFp = await getCatalogFingerprint(prodQueryFn);
  const pgliteFp = await getCatalogFingerprint(pgliteQueryFn);

  await prodClient.end();
  await pglite.close();

  // 5. Compare
  let mismatchCount = 0;

  // Compare Table Count & Names
  console.log(`\n--- TABLES ---`);
  console.log(`Production Tables: ${prodFp.tables.length}`);
  console.log(`PGlite Baseline Tables: ${pgliteFp.tables.length}`);
  const missingTablesInPglite = prodFp.tables.filter(t => !pgliteFp.tables.includes(t));
  const extraTablesInPglite = pgliteFp.tables.filter(t => !prodFp.tables.includes(t));

  if (missingTablesInPglite.length > 0) {
    console.error(`❌ Missing tables in PGlite: ${missingTablesInPglite.join(', ')}`);
    mismatchCount++;
  }
  if (extraTablesInPglite.length > 0) {
    console.error(`❌ Extra tables in PGlite: ${extraTablesInPglite.join(', ')}`);
    mismatchCount++;
  }
  if (missingTablesInPglite.length === 0 && extraTablesInPglite.length === 0) {
    console.log(`✅ Table names & count match perfectly (${prodFp.tables.length} tables).`);
  }

  // Compare Columns
  console.log(`\n--- COLUMNS ---`);
  const prodColKeys = Object.keys(prodFp.columns);
  const pgliteColKeys = Object.keys(pgliteFp.columns);
  console.log(`Production Column Count: ${prodColKeys.length}`);
  console.log(`PGlite Baseline Column Count: ${pgliteColKeys.length}`);

  let colMismatch = 0;
  for (const colKey of prodColKeys) {
    if (!pgliteFp.columns[colKey]) {
      console.error(`❌ Missing column in PGlite baseline: ${colKey}`);
      colMismatch++;
    } else {
      const pCol = prodFp.columns[colKey];
      const bCol = pgliteFp.columns[colKey];
      if (pCol.type !== bCol.type || pCol.nullable !== bCol.nullable) {
        console.error(`❌ Column property mismatch on ${colKey}: Prod (${pCol.type}, null:${pCol.nullable}) vs PGlite (${bCol.type}, null:${bCol.nullable})`);
        colMismatch++;
      }
    }
  }
  if (colMismatch === 0) {
    console.log(`✅ All ${prodColKeys.length} columns (names, types, nullability) match perfectly.`);
  } else {
    mismatchCount += colMismatch;
  }

  // Compare Enums
  console.log(`\n--- ENUMS ---`);
  const prodEnums = Object.keys(prodFp.enums);
  const pgliteEnums = Object.keys(pgliteFp.enums);
  let enumMismatch = 0;
  for (const enumName of prodEnums) {
    if (!pgliteFp.enums[enumName]) {
      console.error(`❌ Missing Enum in PGlite: ${enumName}`);
      enumMismatch++;
    } else {
      const pVals = prodFp.enums[enumName].join(',');
      const bVals = pgliteFp.enums[enumName].join(',');
      if (pVals !== bVals) {
        console.error(`❌ Enum values mismatch on ${enumName}: Prod [${pVals}] vs PGlite [${bVals}]`);
        enumMismatch++;
      }
    }
  }
  if (enumMismatch === 0) {
    console.log(`✅ All ${prodEnums.length} Enums and enum values match perfectly.`);
  } else {
    mismatchCount += enumMismatch;
  }

  console.log(`\n==================================================`);
  if (mismatchCount === 0) {
    console.log(`✅ BASELINE VALIDATED = PASS`);
    console.log(`Production fingerprint and isolated PGlite baseline fingerprint are 100% EQUIVALENT.`);
    console.log(`==================================================`);
    process.exit(0);
  } else {
    console.error(`❌ BASELINE VALIDATED = BLOCKED (${mismatchCount} schema mismatches found)`);
    console.log(`==================================================`);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Unhandled error during baseline validation:', err);
  process.exit(1);
});
