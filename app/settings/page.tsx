import SettingsClient from '@/components/SettingsClient'

export default function SettingsPage() {
  const baseUrl = (process.env.MCP_BASE_URL || process.env.NEXTAUTH_URL || 'https://sleep.arbibe.dev').replace(/\/$/, '')
  return <SettingsClient mcpUrl={`${baseUrl}/mcp`} />
}
