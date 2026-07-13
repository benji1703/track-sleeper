# Setup

1. **Create a Supabase project** at https://supabase.com/dashboard.
2. **Run the migrations**: open the SQL editor in your Supabase project and run the
   files in `supabase/migrations` in numeric order. Migrations 005–007 add
   offline mutation idempotency, per-user preferences, and Web Push subscriptions.
3. **Set up Google OAuth**:
   - Go to https://console.cloud.google.com/apis/credentials, create an OAuth 2.0
     Client ID (Web application).
   - Add authorized redirect URIs:
     - `https://YOUR_DOMAIN/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
4. **Fill in environment variables**: copy `.env.local.example` to `.env.local` and
   fill in the values (Supabase URL/service-role key, NextAuth secret/URL, Google
   client ID/secret). AI, ChatGPT MCP, and Web Push variables are optional;
   generate VAPID keys with `npx web-push generate-vapid-keys` to enable
   caregiver notifications.
5. **Install dependencies**: `npm install`
6. **Run locally**: `npm run dev`
7. **Deploy**: `vercel` (link the project, add the same env vars in the Vercel
   dashboard, then `vercel --prod`).

## Private ChatGPT connection (no OpenAI API key)

The private MCP app lets ChatGPT use your existing ChatGPT plan to discuss
privacy-reduced sleep aggregates. AI runs in ChatGPT; Track Sleeper makes no
OpenAI API call.

1. Run `supabase/migrations/008_mcp_oauth.sql` in the Supabase SQL editor.
2. Set `MCP_BASE_URL=https://YOUR_DOMAIN` in Vercel. It must match the deployed
   HTTPS origin and must not have a trailing slash.
3. Set `MCP_ALLOWED_EMAIL` to the lowercase Google email that is allowed to
   connect. This is strongly recommended for a private deployment.
4. Optionally set `SLEEP_TIMEZONE` (the default is `Asia/Jerusalem`).
5. Redeploy, then check these URLs return JSON:
   - `https://YOUR_DOMAIN/.well-known/oauth-protected-resource`
   - `https://YOUR_DOMAIN/.well-known/oauth-authorization-server`
6. In ChatGPT, enable **Settings → Security and login → Developer mode**.
7. Open **Settings → Plugins**, create a developer-mode app, and enter:
   - Name: `Track Sleeper`
   - MCP server URL: `https://YOUR_DOMAIN/mcp`
   - OAuth registration: dynamic client registration (DCR)
8. Start a new chat, enable Track Sleeper from the composer, and ask:
   `Using Track Sleeper, explain the last seven days and estimate the next sleep window.`

The first tool call opens the Google sign-in flow. Authorization codes are
single-use PKCE codes; access and refresh tokens are stored only as SHA-256
hashes. All exposed tools are read-only. See `docs/MCP_SETUP.md` for protocol,
privacy, troubleshooting, and revocation details.
