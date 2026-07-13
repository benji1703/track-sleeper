import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { MCP_SCOPE } from '@/lib/mcp/config'

const PKCE_RE = /^[A-Za-z0-9._~-]{43,128}$/

export function randomCredential(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function credentialHash(value: string): string {
  return createHash('sha256').update(value).digest('base64url')
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  return PKCE_RE.test(verifier) && credentialHash(verifier) === challenge
}

export function validPkceChallenge(value: string | null): value is string {
  return Boolean(value && PKCE_RE.test(value))
}

export function normalizeScope(value: string | null | undefined): string | null {
  const scopes = [...new Set((value ?? '').split(/\s+/).filter(Boolean))]
  if (scopes.length !== 1 || scopes[0] !== MCP_SCOPE) return null
  return MCP_SCOPE
}

export function validRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash
  } catch {
    return false
  }
}

export function validChatGptRedirectUri(value: unknown): value is string {
  if (!validRedirectUri(value)) return false
  const url = new URL(value)
  return url.origin === 'https://chatgpt.com' && (
    url.pathname.startsWith('/connector/oauth/') ||
    url.pathname === '/connector_platform_oauth_redirect'
  )
}

export interface ConsentPayload {
  clientId: string
  redirectUri: string
  state: string
  resource: string
  scope: string
  codeChallenge: string
  email: string
  expiresAt: number
}

function consentSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is required')
  return secret
}

export function signConsent(payload: ConsentPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', consentSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyConsent(value: string): ConsentPayload | null {
  const [encoded, supplied, extra] = value.split('.')
  if (!encoded || !supplied || extra || encoded.length > 8192) return null
  const expected = createHmac('sha256', consentSecret()).update(encoded).digest()
  let suppliedBytes: Buffer
  try {
    suppliedBytes = Buffer.from(supplied, 'base64url')
  } catch {
    return null
  }
  if (suppliedBytes.toString('base64url') !== supplied) return null
  if (suppliedBytes.length !== expected.length || !timingSafeEqual(suppliedBytes, expected)) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as ConsentPayload
    if (!payload || typeof payload !== 'object' || payload.expiresAt <= Date.now()) return null
    if (!payload.clientId || !payload.redirectUri || !payload.state || !payload.resource || !payload.scope || !payload.codeChallenge || !payload.email) return null
    return payload
  } catch {
    return null
  }
}

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer ([A-Za-z0-9_-]{32,})$/.exec(header)
  return match?.[1] ?? null
}

export function oauthError(error: string, description: string, status = 400): Response {
  return Response.json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } }
  )
}
