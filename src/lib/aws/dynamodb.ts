import { createHash, createHmac, randomUUID } from 'crypto'
import type { Itinerary } from '@/types/travel'

type DynamoAttribute =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { NULL: true }

interface DynamoItem {
  [key: string]: DynamoAttribute
}

export interface SavedTripRecord {
  tripId: string
  sessionId: string
  destination: string
  createdAt: string
  summary: string
  itinerary: Itinerary
}

const service = 'dynamodb'
const algorithm = 'AWS4-HMAC-SHA256'

function env() {
  return {
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.AWS_SESSION_TOKEN || '',
    tableName: process.env.DYNAMODB_TABLE_NAME || '',
  }
}

export function isDynamoConfigured() {
  const config = env()
  return Boolean(config.region && config.accessKeyId && config.secretAccessKey && config.tableName)
}

function hash(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value, 'utf8').digest()
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, region)
  const serviceKey = hmac(regionKey, service)
  return hmac(serviceKey, 'aws4_request')
}

function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

function signedHeadersFor(headers: Record<string, string>) {
  return Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort()
}

async function callDynamo<T>(target: string, body: Record<string, unknown>): Promise<T> {
  const config = env()
  if (!isDynamoConfigured()) {
    throw new Error('DynamoDB is not configured.')
  }

  const host = `dynamodb.${config.region}.amazonaws.com`
  const payload = JSON.stringify(body)
  const now = amzDate()
  const dateStamp = now.slice(0, 8)
  const headers: Record<string, string> = {
    'content-type': 'application/x-amz-json-1.0',
    host,
    'x-amz-date': now,
    'x-amz-target': `DynamoDB_20120810.${target}`,
  }

  if (config.sessionToken) {
    headers['x-amz-security-token'] = config.sessionToken
  }

  const signedHeaderNames = signedHeadersFor(headers)
  const canonicalHeaders = signedHeaderNames.map((key) => `${key}:${headers[key]}`).join('\n') + '\n'
  const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaderNames.join(';'),
    hash(payload),
  ].join('\n')
  const stringToSign = [algorithm, now, credentialScope, hash(canonicalRequest)].join('\n')
  const signature = createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign, 'utf8')
    .digest('hex')

  const authorization = `${algorithm} Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(
    ';'
  )}, Signature=${signature}`

  const response = await fetch(`https://${host}/`, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: payload,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DynamoDB ${target} failed: ${response.status} ${text}`)
  }

  return (await response.json()) as T
}

function stringAttr(value: string): DynamoAttribute {
  return { S: value }
}

function numberAttr(value: number): DynamoAttribute {
  return { N: String(value) }
}

function readString(item: DynamoItem | undefined, key: string) {
  const value = item?.[key]
  return value && 'S' in value ? value.S : ''
}

export async function saveTripSnapshot(sessionId: string, itinerary: Itinerary): Promise<SavedTripRecord> {
  const config = env()
  const createdAt = new Date().toISOString()
  const tripId = itinerary.id || randomUUID()
  const record: SavedTripRecord = {
    tripId,
    sessionId,
    destination: itinerary.trip.destination,
    createdAt,
    summary: itinerary.summary,
    itinerary: {
      ...itinerary,
      id: tripId,
      savedAt: createdAt,
    },
  }

  const item: DynamoItem = {
    pk: stringAttr(`SESSION#${sessionId}`),
    sk: stringAttr(`TRIP#${createdAt}#${tripId}`),
    entityType: stringAttr('TripSnapshot'),
    tripId: stringAttr(tripId),
    sessionId: stringAttr(sessionId),
    destination: stringAttr(record.destination),
    createdAt: stringAttr(createdAt),
    summary: stringAttr(record.summary),
    feasibilityScore: numberAttr(itinerary.feasibilityScore),
    itineraryJson: stringAttr(JSON.stringify(record.itinerary)),
  }

  await callDynamo('PutItem', {
    TableName: config.tableName,
    Item: item,
  })

  return record
}

export async function listTripSnapshots(sessionId: string): Promise<SavedTripRecord[]> {
  const config = env()
  const result = await callDynamo<{ Items?: DynamoItem[] }>('Query', {
    TableName: config.tableName,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :trip)',
    ExpressionAttributeValues: {
      ':pk': stringAttr(`SESSION#${sessionId}`),
      ':trip': stringAttr('TRIP#'),
    },
    ScanIndexForward: false,
    Limit: 10,
  })

  return (result.Items ?? []).flatMap((item) => {
    try {
      const itinerary = JSON.parse(readString(item, 'itineraryJson')) as Itinerary
      return [
        {
          tripId: readString(item, 'tripId'),
          sessionId: readString(item, 'sessionId'),
          destination: readString(item, 'destination'),
          createdAt: readString(item, 'createdAt'),
          summary: readString(item, 'summary'),
          itinerary,
        },
      ]
    } catch {
      return []
    }
  })
}
