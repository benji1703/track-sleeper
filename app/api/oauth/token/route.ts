import { NextRequest } from 'next/server'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  isAllowedMcpUser,
  mcpResource,
  REFRESH_TOKEN_TTL_SECONDS,
} from '@/lib/mcp/config'
import { credentialHash, oauthError, randomCredential, verifyPkce } from '@/lib/mcp/oauth'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

interface StoredCode {
  code_hash: string
  client_id: string
  user_email: string
  redirect_uri: string
  code_challenge: string
  resource: string
  scope: string
  expires_at: string
  used_at: string | null
}

interface StoredToken {
  token_hash: string
  client_id: string
  user_email: string
  resource: string
  scope: string
  expires_at: string
  revoked_at: string | null
}

async function mintTokens(record: Pick<StoredToken, 'client_id' | 'user_email' | 'resource' | 'scope'>) {
  const accessToken = randomCredential()
  const refreshToken = randomCredential()
  const now = Date.now()
  const { error } = await supabaseAdmin.from('mcp_oauth_tokens').insert([
    {
      token_hash: credentialHash(accessToken),
      token_kind: 'access',
      client_id: record.client_id,
      user_email: record.user_email,
      resource: record.resource,
      scope: record.scope,
      expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    },
    {
      token_hash: credentialHash(refreshToken),
      token_kind: 'refresh',
      client_id: record.client_id,
      user_email: record.user_email,
      resource: record.resource,
      scope: record.scope,
      expires_at: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
    },
  ])
  if (error) throw error
  return { accessToken, refreshToken }
}

function tokenResponse(accessToken: string, refreshToken: string, scope: string) {
  return Response.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope,
  }, {
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  })
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`mcp-token:${forwarded}`, 120, 60_000)) {
    return oauthError('temporarily_unavailable', 'Too many token requests.', 429)
  }
  if (req.headers.get('authorization')) {
    return oauthError('invalid_client', 'This public PKCE client must not use client-secret authentication.', 401)
  }
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) {
    return oauthError('invalid_request', 'The token request must use application/x-www-form-urlencoded.')
  }

  const body = await req.text()
  if (body.length > 16_384) return oauthError('invalid_request', 'The token request is too large.')
  const form = new URLSearchParams(body)
  const grantType = form.get('grant_type')
  const clientId = form.get('client_id')
  const resource = form.get('resource')
  if (!clientId || resource !== mcpResource()) {
    return oauthError('invalid_request', 'A valid client_id and resource are required.')
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from('mcp_oauth_clients')
    .select('client_id')
    .eq('client_id', clientId)
    .maybeSingle()
  if (clientError) {
    console.error(clientError)
    return oauthError('server_error', 'The client could not be checked.', 500)
  }
  if (!client) return oauthError('invalid_client', 'Unknown OAuth client.', 401)

  if (grantType === 'authorization_code') {
    const code = form.get('code')
    const verifier = form.get('code_verifier')
    const redirectUri = form.get('redirect_uri')
    if (!code || !verifier || !redirectUri) {
      return oauthError('invalid_request', 'code, code_verifier, and redirect_uri are required.')
    }

    const codeHash = credentialHash(code)
    const { data, error } = await supabaseAdmin
      .from('mcp_oauth_codes')
      .select('*')
      .eq('code_hash', codeHash)
      .maybeSingle()
    if (error) {
      console.error(error)
      return oauthError('server_error', 'The authorization code could not be checked.', 500)
    }
    const stored = data as StoredCode | null
    if (!stored || stored.used_at || Date.parse(stored.expires_at) <= Date.now() || stored.client_id !== clientId || stored.redirect_uri !== redirectUri || stored.resource !== resource || !verifyPkce(verifier, stored.code_challenge)) {
      return oauthError('invalid_grant', 'The authorization code is invalid, expired, or already used.')
    }
    if (!isAllowedMcpUser(stored.user_email)) {
      return oauthError('access_denied', 'This account is no longer allowed to use the private MCP app.', 403)
    }

    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from('mcp_oauth_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('code_hash', codeHash)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('code_hash')
      .maybeSingle()
    if (consumeError) {
      console.error(consumeError)
      return oauthError('server_error', 'The authorization code could not be consumed.', 500)
    }
    if (!consumed) return oauthError('invalid_grant', 'The authorization code was already used.')

    try {
      const tokens = await mintTokens(stored)
      return tokenResponse(tokens.accessToken, tokens.refreshToken, stored.scope)
    } catch (mintError) {
      console.error(mintError)
      return oauthError('server_error', 'Access tokens could not be issued.', 500)
    }
  }

  if (grantType === 'refresh_token') {
    const refreshToken = form.get('refresh_token')
    if (!refreshToken) return oauthError('invalid_request', 'refresh_token is required.')
    const tokenHash = credentialHash(refreshToken)
    const { data, error } = await supabaseAdmin
      .from('mcp_oauth_tokens')
      .select('token_hash,client_id,user_email,resource,scope,expires_at,revoked_at')
      .eq('token_hash', tokenHash)
      .eq('token_kind', 'refresh')
      .maybeSingle()
    if (error) {
      console.error(error)
      return oauthError('server_error', 'The refresh token could not be checked.', 500)
    }
    const stored = data as StoredToken | null
    if (!stored || stored.revoked_at || Date.parse(stored.expires_at) <= Date.now() || stored.client_id !== clientId || stored.resource !== resource) {
      return oauthError('invalid_grant', 'The refresh token is invalid, expired, or revoked.')
    }
    if (!isAllowedMcpUser(stored.user_email)) {
      return oauthError('access_denied', 'This account is no longer allowed to use the private MCP app.', 403)
    }

    const { data: rotated, error: rotateError } = await supabaseAdmin
      .from('mcp_oauth_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('token_hash')
      .maybeSingle()
    if (rotateError) {
      console.error(rotateError)
      return oauthError('server_error', 'The refresh token could not be rotated.', 500)
    }
    if (!rotated) return oauthError('invalid_grant', 'The refresh token was already used.')

    try {
      const tokens = await mintTokens(stored)
      return tokenResponse(tokens.accessToken, tokens.refreshToken, stored.scope)
    } catch (mintError) {
      console.error(mintError)
      return oauthError('server_error', 'Access tokens could not be issued.', 500)
    }
  }

  return oauthError('unsupported_grant_type', 'Only authorization_code and refresh_token grants are supported.')
}
