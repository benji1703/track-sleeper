import MarketingPage from '@/components/marketing/MarketingPage'
import ChatGptMcpGuide from '@/components/ChatGptMcpGuide'

export default function McpDocsPage() {
  const baseUrl = (process.env.MCP_BASE_URL || process.env.NEXTAUTH_URL || 'https://sleep.arbibe.dev').replace(/\/$/, '')
  return (
    <MarketingPage
      eyebrow="Documentation · ChatGPT & MCP"
      title="Bring Sommeil into ChatGPT."
      intro="Connect Sommeil as a private ChatGPT developer-mode plugin powered by MCP. Ask questions about your sleep data without an OpenAI API key."
    >
      <ChatGptMcpGuide mcpUrl={`${baseUrl}/mcp`} />

      <section className="marketing-prose mcp-documentation">
        <h2>What the plugin can access</h2>
        <p>Sommeil exposes three purpose-built, read-only tools:</p>
        <ul>
          <li><code>get_sleep_summary</code> returns 1–30 days of daily totals, averages, nap counts, patterns, and prediction confidence.</li>
          <li><code>get_next_sleep_prediction</code> returns the current sleep state and a personalized next-sleep estimate.</li>
          <li><code>get_daily_briefing</code> returns an evidence-bound daily briefing with a safety caution.</li>
        </ul>

        <h2>What stays private</h2>
        <p>Tool responses exclude names, email addresses, caregiver addresses, notes, exact birth dates, session IDs, and raw session records. ChatGPT receives a result only when you add the Sommeil plugin to a conversation and ask it to use a tool.</p>

        <h2>Disconnect or reconnect</h2>
        <p>Remove Sommeil from ChatGPT’s Plugins settings to disconnect it. If tools change after an update, open the plugin in <strong>Settings → Plugins</strong>, choose <strong>Refresh</strong>, and start a new conversation.</p>

        <h2>Troubleshooting</h2>
        <ul>
          <li><strong>Developer mode is missing:</strong> your ChatGPT workspace may not allow developer-mode apps.</li>
          <li><strong>Access denied:</strong> sign in with the Google account that owns or has caregiver access to the Sommeil profile.</li>
          <li><strong>Tools do not appear:</strong> refresh the plugin metadata, then open a new chat and select Sommeil from the composer.</li>
        </ul>
      </section>
    </MarketingPage>
  )
}
