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

async function migrate() {
  const client = await getClient()
  try {
    await client.query(`
      ALTER TABLE trips
      ADD COLUMN IF NOT EXISTS is_published BOOLEAN
    `)
    console.log('✓ trips.is_published')

    await client.query(`
      UPDATE trips
      SET is_published = false
      WHERE is_published IS NULL
    `)
    console.log('✓ existing trips marked unpublished')

    await client.query(`
      ALTER TABLE trips
      ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ
    `)
    console.log('✓ trips.published_at')

    console.log('\nGallery migration complete.')
  } finally {
    await client.end()
  }
}

migrate().catch((err) => {
  console.error('Gallery migration failed:', err)
  process.exit(1)
})
