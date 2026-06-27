import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client } from 'pg'

const endpoint = process.env.DSQL_CLUSTER_ENDPOINT
const region = process.env.AWS_REGION ?? 'us-east-1'

if (!endpoint) {
  throw new Error('DSQL_CLUSTER_ENDPOINT is required.')
}

async function getClient() {
  const signer = new DsqlSigner({ hostname: endpoint, region })
  const token = await signer.getDbConnectAdminAuthToken()

  const client = new Client({
    host: endpoint,
    user: 'admin',
    password: token,
    database: 'postgres',
    port: 5432,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  return client
}

// Idempotent: safe to re-run. Aurora DSQL has no SET DEFAULT, no REFERENCES,
// no ON CONFLICT; the repo avoids CREATE INDEX (PK/UNIQUE constraints index the
// hot lookups). Application code mints UUIDs and sets version explicitly.
async function migrate() {
  const client = await getClient()
  try {
    // --- trips: optimistic-concurrency + last-writer -----------------------
    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS version BIGINT`)
    await client.query(`UPDATE trips SET version = 1 WHERE version IS NULL`)
    console.log('✓ trips.version (backfilled to 1)')

    await client.query(`ALTER TABLE trips ADD COLUMN IF NOT EXISTS updated_by TEXT`)
    console.log('✓ trips.updated_by')

    // --- shares + roles (owner stays in trips.owner_id) --------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS trip_collaborators (
        id         TEXT NOT NULL PRIMARY KEY,
        trip_id    TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        role       TEXT NOT NULL,
        invited_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE (trip_id, user_id)
      )
    `)
    console.log('✓ trip_collaborators')

    // --- comments (trip/day anchors reliable; activity anchor best-effort) -
    await client.query(`
      CREATE TABLE IF NOT EXISTS trip_comments (
        id                 TEXT NOT NULL PRIMARY KEY,
        trip_id            TEXT NOT NULL,
        user_id            TEXT NOT NULL,
        author_name        TEXT,
        anchor_type        TEXT NOT NULL,
        anchor_day         INTEGER,
        anchor_activity_id TEXT,
        body               TEXT NOT NULL,
        resolved           BOOLEAN NOT NULL,
        created_at         TIMESTAMPTZ NOT NULL,
        updated_at         TIMESTAMPTZ NOT NULL
      )
    `)
    console.log('✓ trip_comments')

    // --- day locks + AI lock, unified (lock_key = 'ai' | 'day:<n>') --------
    await client.query(`
      CREATE TABLE IF NOT EXISTS trip_locks (
        trip_id     TEXT NOT NULL,
        lock_key    TEXT NOT NULL,
        scope       TEXT NOT NULL,
        day_number  INTEGER,
        user_id     TEXT NOT NULL,
        user_name   TEXT,
        acquired_at TIMESTAMPTZ NOT NULL,
        expires_at  TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (trip_id, lock_key)
      )
    `)
    console.log('✓ trip_locks')

    // --- presence ----------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS trip_presence (
        trip_id    TEXT NOT NULL,
        user_id    TEXT NOT NULL,
        user_name  TEXT,
        user_image TEXT,
        last_seen  TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (trip_id, user_id)
      )
    `)
    console.log('✓ trip_presence')

    console.log('\nCollaboration migration complete.')
  } finally {
    await client.end()
  }
}

migrate().catch((err) => {
  console.error('Collaboration migration failed:', err)
  process.exit(1)
})
