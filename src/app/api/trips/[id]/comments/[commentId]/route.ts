import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { auth } from '@/auth'
import { getTripAccess, canManage } from '@/lib/tripAccess'
import type { CommentAnchorType, TripComment } from '@/types/travel'

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

interface PatchCommentBody {
  body?: string
  resolved?: boolean
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

// PATCH — edit a comment's body (author only) or toggle resolved (author or owner).
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, commentId } = await context.params
  const userId = session.user.id
  const { body, resolved }: PatchCommentBody = await req.json()

  if (typeof body === 'undefined' && typeof resolved === 'undefined') {
    return NextResponse.json({ error: 'No comment updates provided.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const existing = await client.query<{ user_id: string }>(
      'SELECT user_id FROM trip_comments WHERE id = $1 AND trip_id = $2',
      [commentId, id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
    }
    const isAuthor = existing.rows[0].user_id === userId
    const isOwner = canManage(access.role)

    // Editing the text is author-only; resolving is allowed for the author or the owner.
    if (typeof body !== 'undefined' && !isAuthor) {
      return NextResponse.json({ error: 'You can only edit your own comments.' }, { status: 403 })
    }
    if (typeof resolved !== 'undefined' && !isAuthor && !isOwner) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }

    const cleanBody = typeof body === 'string' ? body.trim() : undefined
    if (typeof cleanBody === 'string' && !cleanBody) {
      return NextResponse.json({ error: 'A comment cannot be empty.' }, { status: 400 })
    }

    const { rows } = await client.query<CommentRow>(
      `UPDATE trip_comments
       SET body = COALESCE($1, body),
           resolved = COALESCE($2, resolved),
           updated_at = $3
       WHERE id = $4 AND trip_id = $5
       RETURNING id, user_id, author_name, anchor_type, anchor_day, anchor_activity_id, body, resolved, created_at, updated_at`,
      [cleanBody ?? null, typeof resolved === 'boolean' ? resolved : null, new Date(), commentId, id]
    )
    return NextResponse.json({ comment: serializeComment(rows[0]) })
  } catch (err) {
    console.error('Update comment error:', err)
    return NextResponse.json({ error: 'Unable to update this comment.' }, { status: 500 })
  } finally {
    await client.end()
  }
}

// DELETE — remove a comment (author or owner).
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, commentId } = await context.params
  const userId = session.user.id

  const client = await getClient()
  try {
    const access = await getTripAccess(client, id, userId)
    if (!access) {
      return NextResponse.json({ error: 'Trip not found.' }, { status: 404 })
    }

    const existing = await client.query<{ user_id: string }>(
      'SELECT user_id FROM trip_comments WHERE id = $1 AND trip_id = $2',
      [commentId, id]
    )
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })
    }
    if (existing.rows[0].user_id !== userId && !canManage(access.role)) {
      return NextResponse.json({ error: 'Not allowed.' }, { status: 403 })
    }

    await client.query('DELETE FROM trip_comments WHERE id = $1 AND trip_id = $2', [commentId, id])
    return NextResponse.json({ ok: true, id: commentId })
  } catch (err) {
    console.error('Delete comment error:', err)
    return NextResponse.json({ error: 'Unable to delete this comment.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
