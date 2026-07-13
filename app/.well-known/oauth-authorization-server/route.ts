import { authorizationServerMetadata } from '@/lib/mcp/metadata'

export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(authorizationServerMetadata(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
