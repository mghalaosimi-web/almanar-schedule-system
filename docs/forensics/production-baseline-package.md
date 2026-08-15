# Production baseline package — Directive 10.3

## Production fingerprint (read-only, 2026-08-15)

- 35 application tables; no `_prisma_migrations` table.
- Counts: `Student=1005`, `Lecturer=28`, `Admin=3`.
- No normalized-email collisions and no duplicate Google IDs.
- Production uses PostgreSQL enums including `AdminRole = ADMIN, SUPER_ADMIN, UNI_ADMIN, COLLEGE_ADMIN`.
- Core profile primary keys and foreign keys are present. Production has later schema additions not represented by the sole historical migration: `Student.xp`, `Student.streak`, `Student.lastLoginDate`, `Student.isFocusing`; six `NotificationLog` delivery fields; and five `SessionLog` telemetry fields. `Admin.role` defaults to `ADMIN`, not the historical migration's `SUPER_ADMIN`.

## Production-faithful baseline design

Create a new **single baseline migration** from a read-only production schema export using:

```powershell
npx prisma migrate diff --from-empty --to-config-datasource --script
```

The generated SQL must be stored as the baseline migration only after it has been executed successfully against an isolated PostgreSQL-compatible test instance and fingerprinted against production. The old `20260712201500_init` migration must not be marked as applied because it is demonstrably incomplete.

## Why the baseline SQL must never be run on production

It contains `CREATE TABLE`, type, index, and foreign-key statements describing objects that already exist. Executing it on production would attempt to recreate live schema objects. The only permitted production action after validation is `prisma migrate resolve --applied <verified-baseline-name>`.

## Exact validation procedure

1. Generate the baseline SQL from the production datasource read-only.
2. Execute it on an isolated PostgreSQL/PGlite-compatible test instance, never against production.
3. Fingerprint test and production: tables, columns, types, nullability, defaults, keys, unique constraints, foreign keys, indexes, and enums.
4. Require an exact match; otherwise stop and retain this package as the forensic record.
5. Move the obsolete historical migration out of Prisma's active migration directory only after review, add the verified baseline directory, then run `prisma migrate resolve --applied <baseline>` on production.
6. Expected status: verified baseline applied; `20260815000000_unified_auth` pending.
7. Run `prisma migrate deploy` once; it must then apply only unified auth.

## Rollback

Before unified-auth deployment, rollback is only migration-directory/ledger reconciliation; production data remains unchanged. After the additive migration, rollback is to stop using the new tables and retain the nullable profile links—never drop production tables as an emergency action.

## Unified-auth dependency

`20260815000000_unified_auth` must remain pending until the baseline ledger is verified. It is additive: new auth/RBAC/portal tables plus nullable `userId` profile references; no drop or data rewrite is included.
