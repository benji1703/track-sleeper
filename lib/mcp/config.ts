export const MCP_SCOPE = 'sleep:read'
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
export const AUTH_CODE_TTL_SECONDS = 10 * 60

export function appBaseUrl(): string {
  const configured = process.env.MCP_BASE_URL || process.env.NEXTAUTH_URL
  if (!configured) throw new Error('MCP_BASE_URL or NEXTAUTH_URL is required')
  const url = new URL(configured)
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('MCP_BASE_URL must be an origin without a path, query, credentials, or fragment')
  }
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !loopback) {
    throw new Error('MCP_BASE_URL must use HTTPS in production')
  }
  return url.origin
}

export function mcpResource(): string {
  return `${appBaseUrl()}/mcp`
}

export function protectedResourceMetadataUrl(): string {
  return `${appBaseUrl()}/.well-known/oauth-protected-resource`
}

export function sleepTimezone(): string {
  return process.env.SLEEP_TIMEZONE || 'Asia/Jerusalem'
}

export function isAllowedMcpUser(email: string): boolean {
  const allowed = process.env.MCP_ALLOWED_EMAIL?.trim().toLowerCase()
  return !allowed || email.toLowerCase() === allowed
}
