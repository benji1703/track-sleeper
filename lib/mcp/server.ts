import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod/v4'
import { MCP_SCOPE, protectedResourceMetadataUrl } from '@/lib/mcp/config'
import { buildMcpBriefing, buildMcpPrediction, buildMcpSleepSummary, loadMcpSleepData } from '@/lib/mcp/sleepData'

type HandlerExtra = RequestHandlerExtra<ServerRequest, ServerNotification>

const securitySchemes = [{ type: 'oauth2', scopes: [MCP_SCOPE] }]
const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
} as const

const confidenceSchema = z.enum(['low', 'medium', 'high'])
const summaryOutputSchema = {
  generatedAt: z.string(),
  timeZone: z.string(),
  ageBand: z.string(),
  days: z.number().int(),
  averages: z.object({ totalSleepMin: z.number(), nightSleepMin: z.number(), napsPerDay: z.number() }),
  daily: z.array(z.object({
    date: z.string(), totalSleepMin: z.number(), nightSleepMin: z.number(),
    napCount: z.number().int(), longestStretchMin: z.number(),
  })),
  currentStatus: z.enum(['sleeping', 'awake-ok', 'tired-soon', 'overtired']),
  personalization: z.object({
    confidence: confidenceSchema, sampleCount: z.number().int(),
    wakeWindowMin: z.number(), wakeWindowMax: z.number(),
  }),
  observations: z.array(z.string()),
  caution: z.string(),
}
const predictionOutputSchema = {
  generatedAt: z.string(),
  status: z.enum(['sleeping', 'awake-ok', 'tired-soon', 'overtired']),
  estimatedNextSleepAt: z.string().nullable(),
  lastWakeAt: z.string().nullable(),
  wakeWindowMin: z.number(),
  wakeWindowMax: z.number(),
  confidence: confidenceSchema,
  sampleCount: z.number().int(),
  caution: z.string(),
}
const briefingOutputSchema = {
  generatedAt: z.string(),
  timeZone: z.string(),
  ageBand: z.string(),
  headline: z.string(),
  summary: z.string(),
  observations: z.array(z.object({ key: z.string(), text: z.string(), confidence: confidenceSchema })),
  caution: z.string(),
}

function authenticationRequired() {
  const challenge = `Bearer resource_metadata="${protectedResourceMetadataUrl()}", error="invalid_token", error_description="Connect your Sommeil account to continue"`
  return {
    isError: true,
    content: [{ type: 'text' as const, text: 'Authentication required. Connect your Sommeil account to continue.' }],
    _meta: { 'mcp/www_authenticate': [challenge] },
  }
}

function authenticatedEmail(extra: HandlerExtra): string | null {
  const email = extra.authInfo?.extra?.email
  return typeof email === 'string' ? email : null
}

async function withSleepData(extra: HandlerExtra, build: (data: NonNullable<Awaited<ReturnType<typeof loadMcpSleepData>>>) => unknown) {
  const email = authenticatedEmail(extra)
  if (!email) return authenticationRequired()
  try {
    const data = await loadMcpSleepData(email)
    if (!data) {
      return { isError: true, content: [{ type: 'text' as const, text: 'No baby profile is connected to this account.' }] }
    }
    const structuredContent = build(data) as Record<string, unknown>
    return {
      structuredContent,
      content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
    }
  } catch (error) {
    console.error(error)
    return { isError: true, content: [{ type: 'text' as const, text: 'Sommeil could not load sleep data.' }] }
  }
}

export function createMcpServer() {
  const server = new McpServer(
    { name: 'sommeil-sleep', version: '1.0.0' },
    {
      instructions: 'Use only returned sleep evidence. Never diagnose, prescribe treatment, invent causes, or imply certainty beyond the reported confidence. Clearly distinguish recorded data from estimates and retain the safety caution.',
    }
  )

  server.registerTool('get_sleep_summary', {
    title: 'Get sleep summary',
    description: 'Get privacy-reduced daily sleep totals, averages, patterns, and personalization confidence for the authenticated account. Use this before explaining recent sleep trends.',
    inputSchema: {
      days: z.number().int().min(1).max(30).default(7).describe('Number of recent calendar days to summarize, from 1 to 30.'),
    },
    outputSchema: summaryOutputSchema,
    annotations,
    _meta: { securitySchemes },
  }, async ({ days }, extra) => withSleepData(extra, (data) => buildMcpSleepSummary(data, days)))

  server.registerTool('get_next_sleep_prediction', {
    title: 'Get next sleep estimate',
    description: 'Get the current sleep state and personalized next-sleep estimate for the authenticated account. This is guidance rather than medical advice.',
    inputSchema: {},
    outputSchema: predictionOutputSchema,
    annotations,
    _meta: { securitySchemes },
  }, async (_input, extra) => withSleepData(extra, buildMcpPrediction))

  server.registerTool('get_daily_briefing', {
    title: 'Get daily sleep briefing',
    description: 'Get a deterministic, evidence-bound daily sleep briefing for the authenticated account, including observations and a safety caution.',
    inputSchema: {},
    outputSchema: briefingOutputSchema,
    annotations,
    _meta: { securitySchemes },
  }, async (_input, extra) => withSleepData(extra, buildMcpBriefing))

  return server
}
