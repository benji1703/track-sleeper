import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { getBabyForEmail } from '@/lib/babyAccess'
import { AUTH_CODE_TTL_SECONDS, isAllowedMcpUser, mcpResource } from '@/lib/mcp/config'
import {
  type ConsentPayload,
  credentialHash,
  normalizeScope,
  oauthError,
  randomCredential,
  signConsent,
  validPkceChallenge,
  validRedirectUri,
  verifyConsent,
} from '@/lib/mcp/oauth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

function redirectError(redirectUri: string, state: string | null, error: string, description: string) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  if (state) url.searchParams.set('state', state)
  return NextResponse.redirect(url, 303)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!)
}

function consentPage(clientName: string, consentToken: string) {
  const name = escapeHtml(clientName)
  const token = escapeHtml(consentToken)
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect Sommeil</title></head>
<body style="margin:0;background:#f6f1e8;color:#29251f;font-family:system-ui,sans-serif">
<main style="max-width:420px;margin:0 auto;padding:64px 24px">
  <p style="font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#746d62">Sommeil</p>
  <h1 style="font-family:Georgia,serif;font-size:32px;font-weight:500">Connect ${name}?</h1>
  <p style="line-height:1.6;color:#625c53">This grants read-only access to minimized sleep summaries, patterns, and estimates. Names, emails, notes, exact birth dates, session IDs, and raw session records stay private.</p>
  <p style="line-height:1.6;color:#625c53">ChatGPT will receive results only when you ask it to use Sommeil.</p>
  <form method="post" action="/api/oauth/authorize" style="display:flex;gap:12px;margin-top:32px">
    <input type="hidden" name="consent_token" value="${token}">
    <button name="decision" value="deny" type="submit" style="flex:1;padding:14px;border:1px solid #c9c0b2;border-radius:999px;background:transparent;color:#29251f">Cancel</button>
    <button name="decision" value="approve" type="submit" style="flex:1;padding:14px;border:0;border-radius:999px;background:#b85d38;color:white">Connect</button>
  </form>
</main></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  })
}

async function registeredClient(clientId: string, redirectUri: string) {
  const { data, error } = await supabaseAdmin
    .from('mcp_oauth_clients')
    .select('client_name,redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error) throw error
  const redirectUris = Array.isArray(data?.redirect_uris) ? data.redirect_uris as string[] : []
  return data && redirectUris.includes(redirectUri) ? data : null
}

async function issueCode(payload: ConsentPayload) {
  const code = randomCredential()
  const { error } = await supabaseAdmin.from('mcp_oauth_codes').insert({
    code_hash: credentialHash(code),
    client_id: payload.clientId,
    user_email: payload.email,
    redirect_uri: payload.redirectUri,
    code_challenge: payload.codeChallenge,
    resource: payload.resource,
    scope: payload.scope,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString(),
  })
  if (error) throw error
  const callback = new URL(payload.redirectUri)
  callback.searchParams.set('code', code)
  callback.searchParams.set('state', payload.state)
  return NextResponse.redirect(callback, 303)
}

export async function GET(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`mcp-authorize:${forwarded}`, 120, 60_000)) {
    return oauthError('temporarily_unavailable', 'Too many authorization requests.', 429)
  }
  const params = req.nextUrl.searchParams
  const clientId = params.get('client_id')
  const redirectUri = params.get('redirect_uri')
  const state = params.get('state')
  const resource = params.get('resource')
  const scope = normalizeScope(params.get('scope'))
  const challenge = params.get('code_challenge')

  if (!clientId || !redirectUri || !validRedirectUri(redirectUri)) {
    return oauthError('invalid_request', 'client_id and a valid redirect_uri are required.')
  }

  let client: Awaited<ReturnType<typeof registeredClient>>
  try {
    client = await registeredClient(clientId, redirectUri)
  } catch (error) {
    console.error(error)
    return oauthError('server_error', 'The authorization request could not be checked.', 500)
  }
  if (!client) return oauthError('invalid_request', 'The client or redirect URI is not registered.')
  if (params.get('response_type') !== 'code') {
    return redirectError(redirectUri, state, 'unsupported_response_type', 'Only the code response type is supported.')
  }
  if (!state || state.length > 2048) {
    return redirectError(redirectUri, null, 'invalid_request', 'A valid state value is required.')
  }
  if (params.get('code_challenge_method') !== 'S256' || !validPkceChallenge(challenge)) {
    return redirectError(redirectUri, state, 'invalid_request', 'PKCE with the S256 method is required.')
  }
  if (!scope) return redirectError(redirectUri, state, 'invalid_scope', 'Only sleep:read access is supported.')
  if (resource !== mcpResource()) {
    return redirectError(redirectUri, state, 'invalid_target', 'The requested MCP resource is invalid.')
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    const callbackUrl = `${req.nextUrl.pathname}${req.nextUrl.search}`
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`, req.url))
  }

  const email = session.user.email.toLowerCase()
  if (!isAllowedMcpUser(email)) {
    return redirectError(redirectUri, state, 'access_denied', 'This account is not allowed to use the private MCP app.')
  }
  try {
    if (!await getBabyForEmail(email)) {
      return redirectError(redirectUri, state, 'access_denied', 'Create or join a baby profile before connecting ChatGPT.')
    }
  } catch (error) {
    console.error(error)
    return redirectError(redirectUri, state, 'server_error', 'Sommeil could not verify this account.')
  }

  const consentToken = signConsent({
    clientId,
    redirectUri,
    state,
    resource,
    scope,
    codeChallenge: challenge,
    email,
    expiresAt: Date.now() + 5 * 60 * 1000,
  })
  return consentPage(client.client_name, consentToken)
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`mcp-consent:${forwarded}`, 60, 60_000)) {
    return oauthError('temporarily_unavailable', 'Too many consent requests.', 429)
  }
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return oauthError('invalid_request', 'The consent request must use application/x-www-form-urlencoded.')
  }
  const form = new URLSearchParams(await req.text())
  const consentToken = form.get('consent_token')
  const payload = consentToken ? verifyConsent(consentToken) : null
  if (!payload) return oauthError('invalid_request', 'The consent request is invalid or expired.')

  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!email || email !== payload.email || !isAllowedMcpUser(email)) {
    return redirectError(payload.redirectUri, payload.state, 'access_denied', 'The signed-in account does not match this request.')
  }

  try {
    if (!await registeredClient(payload.clientId, payload.redirectUri)) {
      return oauthError('invalid_request', 'The OAuth client is no longer registered.')
    }
    if (form.get('decision') !== 'approve') {
      return redirectError(payload.redirectUri, payload.state, 'access_denied', 'The connection was cancelled.')
    }
    if (!await getBabyForEmail(email)) {
      return redirectError(payload.redirectUri, payload.state, 'access_denied', 'No baby profile is connected to this account.')
    }
    return await issueCode(payload)
  } catch (error) {
    console.error(error)
    return redirectError(payload.redirectUri, payload.state, 'server_error', 'Sommeil could not complete authorization.')
  }
}
