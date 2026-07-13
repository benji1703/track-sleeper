import Link from 'next/link'
import { Check, ExternalLink, LockKeyhole, PlugZap } from 'lucide-react'

export default function ChatGptMcpGuide({
  mcpUrl,
  compact = false,
}: {
  mcpUrl: string
  compact?: boolean
}) {
  return (
    <div className={compact ? 'mcp-guide mcp-guide-compact' : 'mcp-guide'}>
      <ol className="mcp-steps">
        <li>
          <span>01</span>
          <div>
            <h2>Enable Developer mode</h2>
            <p>In ChatGPT, open <strong>Settings → Security and login</strong>, then turn on <strong>Developer mode</strong>. If the option is unavailable, your workspace administrator may need to allow it.</p>
          </div>
        </li>
        <li>
          <span>02</span>
          <div>
            <h2>Create the Sommeil plugin</h2>
            <p>Open <strong>Settings → Plugins</strong>, select the plus button, and create a developer-mode app with these details:</p>
            <dl className="mcp-fields">
              <div><dt>Name</dt><dd>Sommeil Sleep</dd></div>
              <div><dt>Description</dt><dd>Private, read-only sleep summaries, patterns, and next-sleep estimates.</dd></div>
              <div><dt>MCP server URL</dt><dd><code>{mcpUrl}</code></dd></div>
            </dl>
          </div>
        </li>
        <li>
          <span>03</span>
          <div>
            <h2>Approve read-only access</h2>
            <p>ChatGPT will open Sommeil’s Google sign-in and consent screen. Use the same Google account you use for Sommeil and approve the <code>sleep:read</code> permission.</p>
          </div>
        </li>
        <li>
          <span>04</span>
          <div>
            <h2>Ask about sleep</h2>
            <p>Start a new chat, choose <strong>Sommeil Sleep</strong> from the composer’s plugin list, and try:</p>
            <blockquote>“Using Sommeil, explain the last seven days and estimate the next sleep window.”</blockquote>
          </div>
        </li>
      </ol>

      {!compact && (
        <div className="mcp-guide-notes">
          <div><LockKeyhole size={17} /><p><strong>Private connection</strong><span>OAuth protects access, and every exposed tool is read-only.</span></p></div>
          <div><PlugZap size={17} /><p><strong>No API key</strong><span>ChatGPT supplies the model through your ChatGPT account.</span></p></div>
          <div><Check size={17} /><p><strong>You stay in control</strong><span>Remove the plugin from ChatGPT whenever you want.</span></p></div>
        </div>
      )}

      {!compact && (
        <p className="mcp-official-link">
          <Link href="https://developers.openai.com/apps-sdk/deploy/connect-chatgpt" target="_blank" rel="noreferrer">
            OpenAI’s ChatGPT connection guide <ExternalLink size={14} />
          </Link>
        </p>
      )}
    </div>
  )
}
