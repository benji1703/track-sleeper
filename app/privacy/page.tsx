import MarketingPage from '@/components/marketing/MarketingPage'

export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Privacy · Updated July 13, 2026"
      title="Your family’s data stays yours."
      intro="Sommeil is built around data minimization, authenticated access, and clear choices. We collect what is needed to run the product—not to build an advertising profile."
    >
      <section className="marketing-prose privacy-sections">
        <h2>The short version</h2>
        <p>Sommeil does not sell personal data, run behavioral advertising, or use family sleep data to train its own AI models. Core sleep predictions work without generative AI. Optional AI and ChatGPT features are clearly separated and only operate when you enable or invoke them.</p>

        <h2>Information we process</h2>
        <p><strong>Account information:</strong> the email address provided by Google sign-in and the authenticated session needed to keep your account secure.</p>
        <p><strong>Family and sleep information:</strong> the baby profile you create, invited caregiver email addresses, and sleep sessions including start time, end time, sleep type, and any optional notes you add.</p>
        <p><strong>Product settings:</strong> appearance, notification choices, optional AI preference, and push-subscription details when notifications are enabled.</p>

        <h2>Why we use it</h2>
        <p>We use this information to operate the shared sleep tracker, calculate totals and personalized wake-window estimates, keep caregivers synchronized, deliver notifications you request, protect accounts, and provide support. We do not use it for unrelated profiling.</p>

        <h2>Access and security</h2>
        <p>Product pages and APIs require Google authentication. Server-side authorization limits each baby profile to its owner and explicitly invited caregivers. Sensitive server credentials are never sent to the browser. No system is perfectly secure, but Sommeil is designed to reduce exposure and keep access narrowly scoped.</p>

        <h2>Optional AI explanations</h2>
        <p>If the profile owner enables AI daily explanations, Sommeil sends minimized aggregates and evidence-bound observations to OpenAI to generate calm explanatory wording. Names, email addresses, notes, raw session times, and session IDs are excluded. The request is sent with response storage disabled. When this feature is off, deterministic briefings continue to work without generative AI.</p>

        <h2>ChatGPT plugin and MCP</h2>
        <p>If you connect Sommeil to ChatGPT, the connection uses OAuth and the <code>sleep:read</code> scope. ChatGPT can call read-only MCP tools for daily totals, averages, nap counts, confidence, observations, and a next-sleep estimate. Tool results exclude names, emails, caregiver addresses, notes, exact birth dates, session IDs, and raw session records.</p>
        <p>ChatGPT receives these results only when the Sommeil plugin is active in a conversation and a tool is used. Conversation and tool-data handling inside ChatGPT is governed by your ChatGPT account and data-control settings. You can remove the plugin in ChatGPT at any time.</p>

        <h2>Service providers</h2>
        <p>Sommeil relies on Vercel for application hosting, Supabase for database infrastructure, and Google for sign-in. OpenAI processes minimized information only when optional AI explanations are enabled; ChatGPT processes MCP tool results only when you connect and use the plugin. These providers process data to deliver their respective services under their own terms and privacy commitments.</p>

        <h2>Cookies and local storage</h2>
        <p>Sommeil uses essential session technology for sign-in and local browser storage for preferences such as light or dark appearance and offline product behavior. It does not use third-party advertising cookies.</p>

        <h2>Retention and deletion</h2>
        <p>Account and sleep data is retained while the service is provided to you. Account deletion is not currently self-service. You can request deletion of your profile and associated sleep records by emailing <a href="mailto:privacy@sleep.arbibe.dev">privacy@sleep.arbibe.dev</a>. OAuth credentials can also be revoked when you disconnect the ChatGPT plugin.</p>

        <h2>Your choices</h2>
        <p>You can leave notes blank, decline caregiver invitations, disable notifications, keep AI explanations off, and choose not to connect ChatGPT. You may request access, correction, or deletion of your information through the privacy contact above.</p>

        <h2>Health and children’s privacy</h2>
        <p>Sommeil is a tool for caregivers and is not directed to children. It provides planning guidance, not medical advice, diagnosis, or treatment. A child’s cues and guidance from a qualified healthcare professional should take priority over any estimate.</p>

        <h2>Changes to this notice</h2>
        <p>We may update this notice as the product evolves. Material changes will be reflected here with a new effective date.</p>
      </section>
    </MarketingPage>
  )
}
