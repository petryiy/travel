/**
 * Run once to create the NextAuth auth tables in Aurora DSQL.
 * Aurora DSQL does not enforce foreign key constraints, so REFERENCES clauses are omitted.
 *
 * Usage: node --env-file=.env.local --import tsx/esm scripts/migrate-auth.ts
 * Or run inline: see package.json script "db:migrate-auth"
 */

import { getClient } from '../src/lib/db'

async function migrate() {
  const client = await getClient()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              TEXT NOT NULL PRIMARY KEY,
        name            TEXT,
        email           TEXT UNIQUE,
        "emailVerified" TIMESTAMPTZ,
        image           TEXT,
        password        TEXT
      )
    `)
    console.log('✓ users table')

    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id                   TEXT NOT NULL PRIMARY KEY,
        "userId"             TEXT NOT NULL,
        type                 TEXT NOT NULL,
        provider             TEXT NOT NULL,
        "providerAccountId"  TEXT NOT NULL,
        refresh_token        TEXT,
        access_token         TEXT,
        expires_at           BIGINT,
        token_type           TEXT,
        scope                TEXT,
        id_token             TEXT,
        session_state        TEXT,
        UNIQUE(provider, "providerAccountId")
      )
    `)
    console.log('✓ accounts table')

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              TEXT        NOT NULL PRIMARY KEY,
        "sessionToken"  TEXT        NOT NULL UNIQUE,
        "userId"        TEXT        NOT NULL,
        expires         TIMESTAMPTZ NOT NULL
      )
    `)
    console.log('✓ sessions table')

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier  TEXT        NOT NULL,
        token       TEXT        NOT NULL UNIQUE,
        expires     TIMESTAMPTZ NOT NULL,
        PRIMARY KEY(identifier, token)
      )
    `)
    console.log('✓ verification_tokens table')

    console.log('\nMigration complete.')

  } finally {
    await client.end()
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
