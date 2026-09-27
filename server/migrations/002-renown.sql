-- TRIBES-FILE: server/migrations/002-renown.sql
-- PHASE: 2 — Identity & shell
-- Rename loyalty → renown. The v4 vocabulary uses "renown" everywhere.
-- Idempotent: only runs once thanks to schema_migrations ledger.

-- users.renown already exists in base SCHEMA (db.js), so nothing to add.
-- tribes.renown_total already exists too.
-- Nothing to migrate from loyalty since this is a fresh DB.
-- This file exists so the ledger has an entry and future migrations
-- can assume phase 2 was applied.

SELECT 1;