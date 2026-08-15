# Production schema baseline gap — Directive 10.1

Date: 2026-08-15

## Evidence collected (read-only)

- Production database contains 35 application tables and no `_prisma_migrations` table.
- Repository historical migration inventory contains only `20260712201500_init` before the un-applied unified-auth migration.
- Prisma validation passes for the repository schema, but `prisma migrate deploy` stops with `P3005` because the existing database has no migration ledger.
- `prisma migrate diff --from-migrations` cannot perform a direct historical comparison without a configured shadow database. This is not a reason to manufacture migration history.

## Proven differences: historical initial migration vs production

| Object | Historical migration expectation | Production fingerprint | Classification |
|---|---|---|---|
| `Student` | Does not define `xp`, `streak`, `lastLoginDate`, or `isFocusing` | All four columns exist (`xp` default 350, `streak` default 7, nullable `lastLoginDate`, `isFocusing` default false) | EXTRA in production |
| `NotificationLog` | Does not define `title`, `deliveredAt`, `readAt`, `deviceToken`, `platform`, or `broadcastId` | All six columns exist and are nullable | EXTRA in production |
| `SessionLog` | Does not define `userAgent`, `deviceOs`, `browser`, `appVersion`, or `country` | All five columns exist and are nullable | EXTRA in production |
| `Admin.role` default | `SUPER_ADMIN` | `ADMIN` | DIFFERENT |
| migration history | Historical SQL is present in Git | No `_prisma_migrations` table exists | MISSING ledger |

The production fingerprint otherwise confirms the expected core auth profile columns, primary keys, and foreign keys for `Student`, `Lecturer`, `Admin`, `NotificationLog`, and `SessionLog`. It also confirms the production enum `AdminRole = {ADMIN, SUPER_ADMIN, UNI_ADMIN, COLLEGE_ADMIN}`.

## Why automatic baseline is unsafe

Marking `20260712201500_init` as applied would assert an exact database state that is demonstrably false. It would hide later, unrecorded production schema changes and make future migration ordering and rollback ambiguous. Applying the historical migration is equally unsafe because its tables already exist.

## Required reviewed baseline strategy

1. Produce a canonical baseline migration from a DBA-reviewed production schema snapshot, including all currently deployed columns, constraints, enums, indexes, extensions, and foreign keys.
2. Review the generated baseline against a backup or staging clone of production.
3. Establish the Prisma ledger only for that exact baseline; do not mark the historical migration as applied unless the reviewed baseline explicitly incorporates and supersedes it.
4. Run `prisma migrate status` and a schema fingerprint comparison after the ledger is created.
5. Only then apply the additive `20260815000000_unified_auth` migration and verify domain row counts before any backfill.

## Rollback implications

No production schema or data was changed during this investigation. The local unified-auth schema and migration remain un-applied. Rollback is therefore simply to defer deployment; no database rollback is required.
