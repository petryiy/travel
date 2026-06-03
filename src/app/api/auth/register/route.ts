import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const client = await getClient()
  try {
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'An account with that email already exists.' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const id = randomUUID()

    await client.query(
      'INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)',
      [id, name ?? null, email, hashedPassword]
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Register error:', err)
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 })
  } finally {
    await client.end()
  }
}
