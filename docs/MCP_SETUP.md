# Sommeil private ChatGPT plugin (MCP)

This integration exposes Sommeil as a private, read-only MCP server at
`/mcp`. ChatGPT supplies the model through your ChatGPT account, so this path
does not require `OPENAI_API_KEY` or create OpenAI API charges.

## Connect from ChatGPT

1. Sign in to Sommeil at the deployed URL with the Google account that owns or
   has caregiver access to a baby profile.
2. In ChatGPT, open **Settings → Security and login** and enable **Developer
   mode**. Workspace administrators may need to allow this setting.
3. Open **Settings → Plugins** (or `https://chatgpt.com/plugins`), select the
   plus button, and create a developer-mode app.
4. Enter:
   - Name: `Sommeil Sleep`
   - Description: `Private, read-only sleep summaries, patterns, and
     next-sleep estimates.`
   - MCP server URL: `https://YOUR_DOMAIN/mcp`
5. Complete the Sommeil Google sign-in and consent flow. The only requested
   OAuth scope is `sleep:read`.
6. Start a new chat, select **Sommeil Sleep** from the composer's plugin list,
   and ask: `Using Sommeil, explain the last seven days and estimate the next
   sleep window.`

ChatGPT developer mode and plugin availability depend on the user's plan and
workspace policy. The current official connection flow is documented at
https://developers.openai.com/apps-sdk/deploy/connect-chatgpt.

## Data boundary

The tools return daily totals, averages, nap counts, model confidence, an
estimated sleep window, and deterministic observations. They do not return the
baby's name, exact birth date, account email, session IDs, notes, caregiver
addresses, or raw session records. Exact last-wake and estimated-next-sleep
timestamps are returned only by the prediction tool because they are necessary
to answer that request.

ChatGPT receives tool results when you enable the plugin and ask it to use a tool.
Its handling of conversation and tool data is governed by your ChatGPT account
and data-control settings.

## Endpoints

- `POST /mcp` — OAuth-protected, stateless MCP Streamable HTTP transport
- `GET /.well-known/oauth-protected-resource` — protected resource metadata
- `GET /.well-known/oauth-authorization-server` — OAuth server metadata
- `POST /api/oauth/register` — dynamic client registration
- `GET /api/oauth/authorize` — Google-session authorization and PKCE code issue
- `POST /api/oauth/token` — code exchange and rotating refresh tokens

The OAuth scope is exactly `sleep:read`. The server supports public clients,
authorization code + S256 PKCE, and refresh-token rotation. Access tokens last
one hour; refresh tokens last thirty days. Dynamic registration accepts only
ChatGPT's documented `https://chatgpt.com/connector/oauth/...` callback URLs,
and the Google-authenticated user must explicitly approve the connection.

## Tools

- `get_sleep_summary(days)` — 1–30 days of aggregate sleep history
- `get_next_sleep_prediction()` — current state and personalized estimate
- `get_daily_briefing()` — deterministic evidence-bound briefing

All three declare read-only, non-destructive, closed-world annotations.

## Revoking access

Remove the app in ChatGPT and revoke all issued credentials in Supabase:

```sql
update mcp_oauth_tokens
set revoked_at = now()
where revoked_at is null;
```

To fully reset registered ChatGPT clients as well:

```sql
delete from mcp_oauth_clients;
```

Deleting clients cascades to their authorization codes and tokens.

## Troubleshooting

- **Metadata fails:** verify `MCP_BASE_URL` exactly matches the deployed HTTPS
  origin and redeploy after changing it.
- **ChatGPT says OAuth is not implemented:** verify an unauthenticated request
  to `/mcp` returns `401` with a `WWW-Authenticate` header pointing to the
  protected resource metadata endpoint.
- **ChatGPT callback says Bad Request:** verify the consent form redirects to
  ChatGPT with `303 See Other`; a `307` incorrectly repeats the consent `POST`
  against ChatGPT's GET-only OAuth callback.
- **Login returns to the tracker:** verify the deployment includes the login
  callback handling and that `NEXTAUTH_URL` matches the same deployment.
- **Access denied:** `MCP_ALLOWED_EMAIL` must match the Google account in
  lowercase, and that account must own or be invited to a baby profile.
- **Database errors:** run migration `008_mcp_oauth.sql` after migrations 001–007.
- **Tools do not appear:** refresh the developer-mode plugin after deploying
  tool metadata changes, then start a new ChatGPT conversation and select
  Sommeil from the composer.
