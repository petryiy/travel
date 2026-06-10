const BASE = 'https://test.api.amadeus.com'

let tokenCache: { token: string; expiresAt: number } | null = null

export function isAmadeusConfigured(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET)
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token
  }

  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_CLIENT_ID!,
      client_secret: process.env.AMADEUS_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error(`Amadeus token error: ${res.status}`)
  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  return tokenCache.token
}

export async function amadeusGet(
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  if (!isAmadeusConfigured()) throw new Error('AMADEUS_NOT_CONFIGURED')
  const token = await getToken()
  const url = `${BASE}${path}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Amadeus API error: ${res.status} ${path}`)
  return res.json()
}
