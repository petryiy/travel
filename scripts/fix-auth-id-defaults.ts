/**
 * One-time fix: add gen_random_uuid() defaults to the id columns that
 * @auth/pg-adapter expects the DB to auto-generate.
 *
 * Usage: node --env-file=.env.local --import tsx/esm scripts/fix-auth-id-defaults.ts
 * Or:    npm run db:fix-auth-ids
 */

import { getClient } from '../src/lib/db'

async function fix() {
  const client = await getClient()
  try {
    for (const table of ['users', 'accounts', 'sessions']) {
      await client.query(
        `ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`
      )
      console.log(`✓ ${table}.id DEFAULT gen_random_uuid()`)
    }
    console.log('\nDone.')
  } finally {
    await client.end()
  }
}

fix().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
