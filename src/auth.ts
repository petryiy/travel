import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import PostgresAdapter from '@auth/pg-adapter'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { getClient } from '@/lib/db'
import type { Pool } from 'pg'

// Aurora DSQL does not support ALTER COLUMN SET DEFAULT, so it cannot
// auto-generate UUIDs. This proxy intercepts INSERT statements for the
// three auth tables and injects a generated id before the query runs.
const ID_INSERT_RE = /^\s*insert into (users|accounts|sessions)\s*\(/i

function injectId(sql: string, params: unknown[]): [string, unknown[]] {
  if (!ID_INSERT_RE.test(sql)) return [sql, params]
  // 1. Shift existing $N placeholders up by one
  // 2. Prepend `id,` to the column list
  // 3. Prepend `$1,` to the VALUES list (the new uuid slot)
  const patched = sql
    .replace(/\$(\d+)/gi, (_, n) => `$${parseInt(n) + 1}`)
    .replace(/insert into (\w+)\s*\(/i, 'INSERT INTO $1 (id, ')
    .replace(/values\s*\(/i, 'VALUES ($1, ')
  return [patched, [randomUUID(), ...params]]
}

// Aurora DSQL requires a fresh authenticated pg.Client per query because
// the SigV4 token is short-lived and connection pooling is not viable.
// Cast to Pool so @auth/pg-adapter's types are satisfied — it only calls .query().
const dsqlPool = {
  async query(sql: string, params?: unknown[]) {
    const [patchedSql, patchedParams] = injectId(sql, params ?? [])
    const client = await getClient()
    try {
      return await client.query(patchedSql, patchedParams as unknown[])
    } finally {
      await client.end()
    }
  },
} as unknown as Pool

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(dsqlPool),
  trustHost: true,
  // Credentials provider requires JWT sessions — database strategy is not supported for it.
  // The adapter is still used by Google OAuth to persist users/accounts in Aurora DSQL.
  session: { strategy: 'jwt' },

  providers: [
    ...(googleClientId && googleClientSecret
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),

    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const client = await getClient()
        try {
          const { rows } = await client.query<{
            id: string
            name: string | null
            email: string
            password: string | null
          }>(
            'SELECT id, name, email, password FROM users WHERE email = $1',
            [credentials.email as string]
          )

          if (!rows.length || !rows[0].password) return null

          const valid = await bcrypt.compare(
            credentials.password as string,
            rows[0].password
          )
          if (!valid) return null

          return { id: rows[0].id, name: rows[0].name, email: rows[0].email }
        } finally {
          await client.end()
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Persist user.id into the token on first sign-in
      if (user?.id) token.id = user.id
      return token
    },
    async session({ session, token }) {
      // Expose the id from the JWT to server components via auth()
      if (token.id) session.user.id = token.id as string
      return session
    },
  },

  pages: {
    signIn: '/login',
    newUser: '/dashboard',
  },
})
