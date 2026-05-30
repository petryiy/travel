import { NextResponse } from 'next/server'
import { isDynamoConfigured } from '@/lib/aws/dynamodb'

export async function GET() {
  return NextResponse.json({
    database: 'Amazon DynamoDB',
    configured: isDynamoConfigured(),
    tableName: process.env.DYNAMODB_TABLE_NAME || null,
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || null,
  })
}
