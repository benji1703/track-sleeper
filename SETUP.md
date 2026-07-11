# Setup

1. **Create a Supabase project** at https://supabase.com/dashboard.
2. **Run the migrations**: open the SQL editor in your Supabase project and run the
   contents of `supabase/migrations/001_init.sql`, then `supabase/migrations/002_caregivers.sql`
   (adds baby sharing / caregivers).
3. **Set up Google OAuth**:
   - Go to https://console.cloud.google.com/apis/credentials, create an OAuth 2.0
     Client ID (Web application).
   - Add authorized redirect URIs:
     - `https://YOUR_DOMAIN/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google` (for local dev)
4. **Fill in environment variables**: copy `.env.local.example` to `.env.local` and
   fill in the values (Supabase URL/service-role key, NextAuth secret/URL, Google
   client ID/secret).
5. **Install dependencies**: `npm install`
6. **Run locally**: `npm run dev`
7. **Deploy**: `vercel` (link the project, add the same env vars in the Vercel
   dashboard, then `vercel --prod`).
