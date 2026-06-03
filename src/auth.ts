import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import PostgresAdapter from '@auth/pg-adapter'
import bcrypt from 'bcryptjs'
import { getClient } from '@/lib/db'
import type { Pool } from 'pg'

// Aurora DSQL requires a fresh authenticated pg.Client per query because
// the SigV4 token is short-lived and connection pooling is not viable.
// Cast to Pool so @auth/pg-adapter's types are satisfied — it only calls .query().
const dsqlPool = {
  async query(sql: string, params?: unknown[]) {
    const client = await getClient()
    try {
      return await client.query(sql, params as unknown[])
    } finally {
      await client.end()
    }
  },
} as unknown as Pool

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PostgresAdapter(dsqlPool),
  // Credentials provider requires JWT sessions — database strategy is not supported for it.
  // The adapter is still used by Google OAuth to persist users/accounts in Aurora DSQL.
  session: { strategy: 'jwt' },

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

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
