import { BrainCircuit, Moon, Users } from 'lucide-react'
import MarketingPage from '@/components/marketing/MarketingPage'

export default function HowItWorksPage() {
  return (
    <MarketingPage
      eyebrow="How it works"
      title="Intelligence that begins with one tap."
      intro="Sommeil turns a lightweight shared sleep log into personalized wake-window estimates, evidence-based briefings, and AI conversations you control."
    >
      <section className="marketing-steps">
        <article><span>01</span><Moon /><h2>Tap when sleep begins</h2><p>Choose nap or night, adjust the start time only when needed, and leave the timer running.</p></article>
        <article><span>02</span><BrainCircuit /><h2>Let the model learn</h2><p>Each completed session updates totals, stretches, and a personalized estimate grounded in age-aware guidance and recent history.</p></article>
        <article><span>03</span><Users /><h2>Share one timeline</h2><p>Invite another caregiver by email. Both Google accounts see and update the same baby’s sleep history.</p></article>
      </section>
      <section className="marketing-prose">
        <h2>Personalization that earns confidence</h2>
        <p>Sommeil starts with age-based wake-window guidance. As completed sleep sessions accumulate, recent patterns contribute more to the estimate. The app shows its confidence instead of presenting a prediction as certainty.</p>
        <p>Optional AI turns those calculated patterns into calm, plain-language briefings. The underlying prediction model remains deterministic and continues to work when AI explanations are disabled.</p>
        <h2>Available wherever questions happen</h2>
        <p>Sommeil’s private MCP server lets authorized families connect read-only sleep tools to ChatGPT as a developer-mode plugin. Ask about the last week, explore changes, or request the next sleep estimate without sharing names, notes, or raw session records.</p>
        <p>Predictions are planning aids, not medical advice. Your baby’s cues and your pediatrician’s guidance always matter more than a clock.</p>
      </section>
    </MarketingPage>
  )
}
