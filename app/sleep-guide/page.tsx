import MarketingPage from '@/components/marketing/MarketingPage'

const WINDOWS = [
  ['0–3 months', '60–90 min', '4–5 naps'],
  ['3–6 months', '1.5–2.5 h', '3–4 naps'],
  ['6–9 months', '2–3 h', '2–3 naps'],
  ['9–12 months', '2.5–3.5 h', '2 naps'],
  ['12–18 months', '3–4 h', '1–2 naps'],
  ['18+ months', '4–6 h', '1 nap'],
]

export default function SleepGuidePage() {
  return (
    <MarketingPage
      eyebrow="Sleep guide"
      title="Useful ranges, never rigid schedules."
      intro="Wake windows offer a starting point for noticing patterns. They are broad by design because babies vary from day to day."
    >
      <section className="guide-table" aria-label="Typical wake windows by age">
        <header><span>Age</span><span>Wake window</span><span>Typical naps</span></header>
        {WINDOWS.map(([age, window, naps]) => <div key={age}><strong>{age}</strong><span>{window}</span><span>{naps}</span></div>)}
      </section>
      <section className="marketing-prose">
        <h2>Read the baby, then the estimate</h2>
        <p>Yawning, looking away, slower movement, fussiness, and difficulty engaging can all be tired cues. Some babies show them early; others show almost none until they are overtired.</p>
        <p>Safe sleep recommendations and medical concerns should come from your pediatrician and recognized public-health guidance. Sommeil does not diagnose sleep problems.</p>
        <h2>Sources used in the app</h2>
        <p>Guidance links inside Sommeil point to the American Academy of Sleep Medicine, the American Academy of Pediatrics, the National Sleep Foundation, and the NHS.</p>
      </section>
    </MarketingPage>
  )
}
