import { protectedResourceMetadata } from '@/lib/mcp/metadata'

export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(protectedResourceMetadata(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
