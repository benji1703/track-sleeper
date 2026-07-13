import MarketingPage from '@/components/marketing/MarketingPage'

export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Privacy"
      title="Family data should remain family data."
      intro="Sommeil collects only what it needs to provide authenticated, shared sleep tracking."
    >
      <section className="marketing-prose privacy-sections">
        <h2>What is stored</h2>
        <p>Your Google account email, the baby profile you create, invited caregiver emails, and sleep sessions including start time, end time, type, and optional notes.</p>
        <h2>How access works</h2>
        <p>Application pages and APIs require an authenticated Google session. Data access is scoped on the server to the owner or an explicitly invited caregiver. Browser clients never receive the Supabase service-role key.</p>
        <h2>Infrastructure</h2>
        <p>The application is designed for hosting on Vercel with data stored in Supabase. Those providers process requests needed to operate the service.</p>
        <h2>Optional ChatGPT connection</h2>
        <p>If you privately connect Sommeil to ChatGPT, read-only tools send minimized sleep aggregates and estimates only when you ask ChatGPT to use them. Names, emails, notes, exact birth dates, session IDs, and raw session records are excluded. You can remove the connection in ChatGPT and revoke its tokens at any time.</p>
        <h2>What is not done</h2>
        <p>Sommeil does not sell sleep data or use it for advertising. Account deletion is not currently self-service and should be completed directly in the database by the operator.</p>
      </section>
    </MarketingPage>
  )
}
