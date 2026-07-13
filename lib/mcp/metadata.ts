import { appBaseUrl, MCP_SCOPE, mcpResource } from '@/lib/mcp/config'

export function protectedResourceMetadata() {
  const baseUrl = appBaseUrl()
  return {
    resource: mcpResource(),
    authorization_servers: [baseUrl],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'],
    resource_documentation: `${baseUrl}/docs/mcp`,
  }
}

export function authorizationServerMetadata() {
  const baseUrl = appBaseUrl()
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [MCP_SCOPE],
  }
}
