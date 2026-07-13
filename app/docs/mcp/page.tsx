import MarketingPage from '@/components/marketing/MarketingPage'

export default function McpDocsPage() {
  const baseUrl = (process.env.MCP_BASE_URL || process.env.NEXTAUTH_URL || 'https://YOUR_DOMAIN').replace(/\/$/, '')
  return (
    <MarketingPage
      eyebrow="ChatGPT"
      title="Talk with your sleep data privately."
      intro="Connect Sommeil to your own ChatGPT account without an OpenAI API key."
    >
      <section className="marketing-prose privacy-sections">
        <h2>Connect</h2>
        <p>Enable Developer mode in ChatGPT, create a private developer-mode app, and use this MCP server URL:</p>
        <p><code>{baseUrl}/mcp</code></p>
        <p>ChatGPT asks you to sign in with Google while connecting. Access is read-only and can be removed from ChatGPT at any time.</p>
        <h2>What ChatGPT can receive</h2>
        <p>Daily totals, averages, nap counts, confidence, evidence-bound observations, and an estimated next sleep window. Names, emails, notes, exact birth dates, session IDs, and raw session records are excluded.</p>
        <h2>Try asking</h2>
        <p>“Using Track Sleeper, explain the last seven days and estimate the next sleep window.”</p>
      </section>
    </MarketingPage>
  )
}
