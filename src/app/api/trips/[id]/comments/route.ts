import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess, canComment } from '@/lib/tripAccess'
import type { CommentAnchorType, TripComment } from '@/types/travel'

const ANCHOR_TYPES: CommentAnchorType[] = ['trip', 'day', 'activity']

interface CommentRow {
  id: string
  user_id: string
  author_name: string | null
  anchor_type: string
  anchor_day: number | null
  anchor_activity_id: string | null
  body: string
  resolved: boolean
  created_at: Date
  updated_at: Date
}

interface CreateCommentBody {
  body?: string
  anchorType?: string
  anchorDay?: number | null
  anchorActivityId?: string | null
}

function serializeComment(row: CommentRow): TripComment {
  return {
    id: row.id,
    userId: row.user_id,
    authorName: row.author_name,
    anchorType: row.anchor_type as CommentAnchorType,
    anchorDay: row.anchor_day,
    anchorActivityId: row.anchor_activity_id,
    body: row.body,
    resolved: Boolean(row.resolved),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

// GET — list all comments on a trip. Any participant may read.
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const { rows } = await client.query<CommentRow>(
      `SELECT id, user_id, author_name, anchor_type, anchor_day, anchor_activity_id, body,
              resolved, created_at, updated_at
       FROM trip_comments
       WHERE trip_id = $1
       ORDER BY created_at ASC`,
      [id]
    )
    return NextResponse.json({ comments: rows.map(serializeComment) })
  } catch (err) {
    console.error('List comments error:', err)
    return NextResponse.json({ error: 'Unable to load comments.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

// POST — add a comment. Commenter, editor, or owner.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await context.params
  const userId = session.user.id
  const { body, anchorType, anchorDay, anchorActivityId }: CreateCommentBody = await req.json()

  const cleanBody = (body ?? '').trim()
  if (!cleanBody) {
    return NextResponse.json({ error: 'A comment cannot be empty.' }, { status: 400 })
  }
  if (cleanBody.length > 2000) {
    return NextResponse.json({ error: 'That comment is too long.' }, { status: 400 })
  }
  const type = (anchorType ?? 'trip') as CommentAnchorType
  if (!ANCHOR_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid comment anchor.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }
    if (!canComment(access.role)) {
      return NextResponse.json({ error: 'You do not have permission to comment.' }, { status: 403 })
    }

    const now = new Date()
    const day = type === 'day' || type === 'activity' ? anchorDay ?? null : null
    const activityId = type === 'activity' ? anchorActivityId ?? null : null

    const { rows } = await client.query<CommentRow>(
      `INSERT INTO trip_comments
         (id, trip_id, user_id, author_name, anchor_type, anchor_day, anchor_activity_id, body, resolved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $9)
       RETURNING id, user_id, author_name, anchor_type, anchor_day, anchor_activity_id, body, resolved, created_at, updated_at`,
      [randomUUID(), id, userId, session.user.name ?? null, type, day, activityId, cleanBody, now]
    )
    return NextResponse.json({ comment: serializeComment(rows[0]) })
  } catch (err) {
    console.error('Create comment error:', err)
    return NextResponse.json({ error: 'Unable to post this comment.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
