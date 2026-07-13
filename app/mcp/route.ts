import { NextRequest } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateMcpRequest } from '@/lib/mcp/auth'
import { protectedResourceMetadataUrl } from '@/lib/mcp/config'
import { createMcpServer } from '@/lib/mcp/server'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version, MCP-Session-Id, WWW-Authenticate',
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function unauthorized(): Response {
  const metadata = protectedResourceMetadataUrl()
  return withCors(Response.json({ error: 'invalid_token' }, {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer resource_metadata="${metadata}", scope="sleep:read"`,
      'Cache-Control': 'no-store',
    },
  }))
}

async function handle(req: NextRequest) {
  try {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!rateLimit(`mcp-request:${forwarded}`, 240, 60_000)) {
      return withCors(Response.json({ error: 'rate_limited' }, { status: 429 }))
    }
    const authentication = await authenticateMcpRequest(req)
    if (authentication.status !== 'authenticated') return unauthorized()

    const rateKey = `mcp:${authentication.authInfo.extra?.email}`
    if (!rateLimit(rateKey, 120, 60_000)) {
      return withCors(Response.json({ error: 'rate_limited' }, { status: 429 }))
    }

    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true })
    const server = createMcpServer()
    await server.connect(transport)
    const response = await transport.handleRequest(req, {
      authInfo: authentication.authInfo,
    })
    return withCors(response)
  } catch (error) {
    console.error(error)
    return withCors(Response.json({ error: 'mcp_server_error' }, { status: 500 }))
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const GET = handle
export const POST = handle
export const DELETE = handle
