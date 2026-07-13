import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { isAllowedMcpUser, MCP_SCOPE, mcpResource } from '@/lib/mcp/config'
import { credentialHash, parseBearerToken } from '@/lib/mcp/oauth'
import { supabaseAdmin } from '@/lib/supabase'

export type McpAuthentication =
  | { status: 'anonymous' }
  | { status: 'invalid' }
  | { status: 'authenticated'; authInfo: AuthInfo }

export async function authenticateMcpRequest(req: Request): Promise<McpAuthentication> {
  const authorization = req.headers.get('authorization')
  if (!authorization) return { status: 'anonymous' }
  const token = parseBearerToken(authorization)
  if (!token) return { status: 'invalid' }

  const { data, error } = await supabaseAdmin
    .from('mcp_oauth_tokens')
    .select('client_id,user_email,resource,scope,expires_at,revoked_at')
    .eq('token_hash', credentialHash(token))
    .eq('token_kind', 'access')
    .maybeSingle()
  if (error) throw error
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return { status: 'invalid' }
  if (data.resource !== mcpResource() || data.scope !== MCP_SCOPE || !isAllowedMcpUser(data.user_email)) {
    return { status: 'invalid' }
  }

  return {
    status: 'authenticated',
    authInfo: {
      token,
      clientId: data.client_id,
      scopes: [MCP_SCOPE],
      expiresAt: Math.floor(Date.parse(data.expires_at) / 1000),
      resource: new URL(data.resource),
      extra: { email: data.user_email },
    },
  }
}
