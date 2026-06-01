import { DsqlSigner } from '@aws-sdk/dsql-signer'
import { Client, types } from 'pg'

// Aurora DSQL returns JSON columns as strings; parse them automatically
types.setTypeParser(114, JSON.parse)

const endpoint = process.env.DSQL_CLUSTER_ENDPOINT!
const region = process.env.AWS_REGION ?? 'us-east-1'

export async function getClient(): Promise<Client> {
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
