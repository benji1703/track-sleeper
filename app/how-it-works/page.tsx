import { BellRing, Moon, Users } from 'lucide-react'
import MarketingPage from '@/components/marketing/MarketingPage'

export default function HowItWorksPage() {
  return (
    <MarketingPage
      eyebrow="How it works"
      title="A sleep log that asks almost nothing of you."
      intro="Sommeil turns two simple taps into a shared sleep timeline and increasingly personal wake-window estimates."
    >
      <section className="marketing-steps">
        <article><span>01</span><Moon /><h2>Tap when sleep begins</h2><p>Choose nap or night, adjust the start time only when needed, and leave the timer running.</p></article>
        <article><span>02</span><BellRing /><h2>Tap when baby wakes</h2><p>The completed session immediately joins today’s timeline and updates totals, stretches, and predictions.</p></article>
        <article><span>03</span><Users /><h2>Share one timeline</h2><p>Invite another caregiver by email. Both Google accounts see and update the same baby’s sleep history.</p></article>
      </section>
      <section className="marketing-prose">
        <h2>Predictions that learn gradually</h2>
        <p>Sommeil starts with age-based wake-window guidance. As completed sleep sessions accumulate, recent patterns contribute more to the estimate. The app shows its confidence instead of presenting an estimate as certainty.</p>
        <p>Predictions are planning aids, not medical advice. Your baby’s cues and your pediatrician’s guidance always matter more than a clock.</p>
      </section>
    </MarketingPage>
  )
}
