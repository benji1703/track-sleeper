import { NextRequest } from 'next/server'
import { randomCredential, validChatGptRedirectUri, oauthError } from '@/lib/mcp/oauth'
import { rateLimit } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface RegistrationRequest {
  client_name?: unknown
  redirect_uris?: unknown
  token_endpoint_auth_method?: unknown
  grant_types?: unknown
  response_types?: unknown
}

export async function POST(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`mcp-register:${forwarded}`, 20, 60 * 60 * 1000)) {
    return oauthError('temporarily_unavailable', 'Too many client registrations.', 429)
  }

  let body: RegistrationRequest
  try {
    body = await req.json()
  } catch {
    return oauthError('invalid_client_metadata', 'The registration body must be JSON.')
  }

  if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length < 1 || body.redirect_uris.length > 10 || !body.redirect_uris.every(validChatGptRedirectUri)) {
    return oauthError('invalid_redirect_uri', 'Only ChatGPT OAuth redirect URIs are allowed.')
  }
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') {
    return oauthError('invalid_client_metadata', 'Only public PKCE clients are supported.')
  }
  if (body.response_types !== undefined && (!Array.isArray(body.response_types) || body.response_types.some((value) => value !== 'code'))) {
    return oauthError('invalid_client_metadata', 'Only the code response type is supported.')
  }
  if (body.grant_types !== undefined && (!Array.isArray(body.grant_types) || body.grant_types.some((value) => value !== 'authorization_code' && value !== 'refresh_token'))) {
    return oauthError('invalid_client_metadata', 'Only authorization_code and refresh_token grants are supported.')
  }

  const clientId = `mcp_${randomCredential(24)}`
  const clientName = typeof body.client_name === 'string' && body.client_name.trim()
    ? body.client_name.trim().slice(0, 120)
    : 'ChatGPT'
  const redirectUris = [...new Set(body.redirect_uris as string[])]
  const { error } = await supabaseAdmin.from('mcp_oauth_clients').insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
  })
  if (error) {
    console.error(error)
    return oauthError('server_error', 'The client could not be registered.', 500)
  }

  return Response.json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }, {
    status: 201,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  })
}
