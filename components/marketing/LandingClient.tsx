'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesCombined,
  Check,
  History,
  LockKeyhole,
  MessagesSquare,
  Moon,
  PlugZap,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import PublicHeader from '@/components/marketing/PublicHeader'

gsap.registerPlugin(useGSAP, ScrollTrigger)

export default function LandingClient() {
  const root = useRef<HTMLElement>(null)
  const phone = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const media = gsap.matchMedia()

      media.add(
        {
          reduceMotion: '(prefers-reduced-motion: reduce)',
          fullMotion: '(prefers-reduced-motion: no-preference)',
        },
        (context) => {
          const { reduceMotion } = context.conditions as { reduceMotion: boolean }

          if (reduceMotion) {
            gsap.set('[data-hero-reveal], [data-reveal]', { opacity: 1, y: 0, clearProps: 'transform' })
            return
          }

          gsap
            .timeline({ defaults: { ease: 'power3.out' } })
            .from('[data-hero-copy]', { opacity: 0, y: 24, duration: 0.75, stagger: 0.1 })
            .from('[data-phone]', { opacity: 0, y: 64, rotate: 2, duration: 1 }, '-=0.55')
            .from('[data-phone-ui]', { opacity: 0, y: 12, duration: 0.45, stagger: 0.06 }, '-=0.5')

          gsap.to('[data-float]', {
            y: -8,
            duration: 2.8,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          })

          gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
            gsap.from(element, {
              opacity: 0,
              y: 36,
              duration: 0.8,
              ease: 'power3.out',
              scrollTrigger: { trigger: element, start: 'top 86%', once: true },
            })
          })

          gsap.from('[data-timeline-fill]', {
            scaleX: 0,
            transformOrigin: 'left center',
            duration: 1.2,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: '[data-timeline-fill]', start: 'top 82%', once: true },
          })
        }
      )

      return () => media.revert()
    },
    { scope: root }
  )

  function handlePointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!phone.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    gsap.to(phone.current, {
      rotateY: x * 5,
      rotateX: y * -4,
      x: x * 8,
      y: y * 6,
      duration: 0.6,
      ease: 'power2.out',
      transformPerspective: 1000,
    })
  }

  function resetPointer() {
    if (!phone.current) return
    gsap.to(phone.current, { rotateX: 0, rotateY: 0, x: 0, y: 0, duration: 0.8, ease: 'power3.out' })
  }

  return (
    <main ref={root} className="landing-page">
      <section className="landing-hero" onPointerMove={handlePointerMove} onPointerLeave={resetPointer}>
        <PublicHeader inverse />
        <div className="landing-hero-inner">
          <div className="landing-copy">
            <p data-hero-copy className="landing-kicker"><Sparkles size={14} /> Adaptive sleep intelligence for families</p>
            <h1 data-hero-copy>Understand sleep.<br /><em>Rest easier.</em></h1>
            <p data-hero-copy className="landing-lede">
              Sommeil turns effortless sleep tracking into personalized windows, clear daily
              briefings, and answers you can explore with AI.
            </p>
            <div data-hero-copy className="landing-actions">
              <Link href="/login" className="landing-primary">
                Start for free <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link href="/docs/mcp" className="landing-secondary"><MessagesSquare size={17} /> Use with ChatGPT</Link>
            </div>
            <div data-hero-copy className="landing-assurance">
              <span><Check size={13} /> No card required</span>
              <span><LockKeyhole size={13} /> Private by design</span>
            </div>
          </div>

          <div className="phone-stage" aria-label="Sommeil app preview">
            <div ref={phone} data-phone data-float className="iphone-shell">
              <div className="iphone-island" />
              <div className="iphone-screen">
                <div data-phone-ui className="phone-status"><span>9:41</span><span>5G&nbsp;&nbsp;96%</span></div>
                <div data-phone-ui className="phone-heading">
                  <div><span>Mila</span><small><i /> Up to date</small></div>
                  <strong>Awake now</strong>
                </div>
                <div data-phone-ui className="phone-awake-card">
                  <div className="phone-focus">
                    <span className="phone-chip">Tired soon</span>
                    <small>Likely sleepy around</small>
                    <strong>19:40</strong>
                    <button type="button" tabIndex={-1}>Wake window 2h–3h ›</button>
                  </div>
                  <div className="phone-start">Start sleep</div>
                  <div className="phone-adjust">Adjust type or start time</div>
                </div>
                <div data-phone-ui className="phone-estimate"><span>How this estimate is calculated</span><b>Medium</b></div>
                <div data-phone-ui className="hero-insight-card">Wake windows have been shortening this week</div>
                <div data-phone-ui className="phone-today">
                  <span>Today</span>
                  <div><i /><i /><i /></div>
                  <aside><span>00:00</span><span>12:00</span><span>24:00</span></aside>
                </div>
                <nav data-phone-ui className="phone-nav" aria-label="App preview navigation">
                  <span><Moon size={13} /><b>Now</b></span>
                  <span><History size={13} /><b>Timeline</b></span>
                  <span><ChartNoAxesCombined size={13} /><b>Insights</b></span>
                  <span><Settings size={13} /><b>Family</b></span>
                </nav>
                <div className="phone-home-indicator" />
              </div>
            </div>
          </div>
        </div>
        <a href="#rhythm" className="landing-scroll-cue">Scroll to explore</a>
      </section>

      <div className="landing-capabilities" aria-label="Sommeil capabilities">
        <span>One-tap tracking</span><i />
        <span>Adaptive predictions</span><i />
        <span>AI daily briefings</span><i />
        <span>ChatGPT via MCP</span>
      </div>

      <section id="rhythm" className="landing-band landing-rhythm">
        <div className="landing-section-heading" data-reveal>
          <p>Sleep intelligence, minus the noise</p>
          <h2>Built around your baby.<br />Designed around real life.</h2>
        </div>
        <div className="rhythm-list">
          <article data-reveal><Moon /><span>01</span><h3>Capture the moment</h3><p>Start and stop sleep in one tap. The interface stays calm, contextual, and usable with one hand at 3 a.m.</p></article>
          <article data-reveal><BrainCircuit /><span>02</span><h3>Learn the rhythm</h3><p>Sommeil blends age-aware guidance with your recent history to create adaptive wake-window estimates with visible confidence.</p></article>
          <article data-reveal><ChartNoAxesCombined /><span>03</span><h3>See what changed</h3><p>Daily briefings turn fragments into evidence-based observations—without diagnosing, judging, or inventing certainty.</p></article>
          <article data-reveal><Users /><span>04</span><h3>Stay in sync</h3><p>Caregivers share one live timeline, so everyone knows what happened and what may come next.</p></article>
        </div>
      </section>

      <section id="insights" className="landing-band landing-story">
        <div className="story-copy" data-reveal>
          <p>From data to a useful next step</p>
          <h2>A whole day, readable in a glance.</h2>
          <p>See sleep totals, nap patterns, longest stretches, and the next likely sleep window in one quiet view. Sommeil explains how confident it is, because parents deserve context—not black-box answers.</p>
          <Link href="/how-it-works">Explore the product <ArrowRight size={17} /></Link>
        </div>
        <div className="story-visual" data-reveal>
          <div className="story-day"><span>6 PM</span><span>Midnight</span><span>6 AM</span></div>
          <div className="story-line"><i data-timeline-fill /></div>
          <div className="story-metrics"><div><small>Total sleep</small><strong>12h 48m</strong></div><div><small>Longest stretch</small><strong>6h 22m</strong></div></div>
          <div className="story-confidence"><Sparkles size={14} /><span>Prediction confidence</span><strong>Growing</strong></div>
        </div>
      </section>

      <section id="chatgpt" className="landing-band landing-chatgpt">
        <div className="chatgpt-copy" data-reveal>
          <p><PlugZap size={14} /> ChatGPT plugin · Powered by MCP</p>
          <h2>Your sleep data can join the conversation.</h2>
          <p>Connect Sommeil as a private ChatGPT developer-mode plugin through the Model Context Protocol. Ask about recent patterns or the next sleep window using privacy-reduced, read-only tools.</p>
          <div className="chatgpt-actions">
            <Link href="/docs/mcp" className="landing-primary">Read the setup guide <ArrowRight size={17} /></Link>
            <span>No OpenAI API key needed</span>
          </div>
        </div>
        <div className="chat-preview" data-reveal aria-label="Example ChatGPT conversation with Sommeil">
          <div className="chat-preview-top"><span><Sparkles size={14} /> ChatGPT + Sommeil</span><i>Read only</i></div>
          <div className="chat-bubble chat-bubble-user">How has sleep changed this week?</div>
          <div className="chat-tool"><PlugZap size={13} /><span>Sommeil · get_sleep_summary</span><Check size={13} /></div>
          <div className="chat-bubble chat-bubble-ai">Night sleep was more consistent across the last four days. The longest stretch increased, while nap count stayed stable.</div>
          <div className="chat-preview-note"><LockKeyhole size={13} /> Names, emails, notes, and raw sessions stay private.</div>
        </div>
      </section>

      <section id="trust" className="landing-band landing-trust">
        <div className="landing-section-heading" data-reveal>
          <p>Trust is part of the product</p>
          <h2>Thoughtful AI starts with clear boundaries.</h2>
        </div>
        <div className="trust-grid">
          <article data-reveal><LockKeyhole /><h3>Your data is not the product</h3><p>Sommeil does not sell family data or use it for advertising.</p></article>
          <article data-reveal><BrainCircuit /><h3>AI stays optional</h3><p>Core predictions work without generative AI. AI explanations are opt-in and use minimized aggregates.</p></article>
          <article data-reveal><Check /><h3>Guidance, not diagnosis</h3><p>Every estimate is framed with confidence and safety context. Sommeil does not provide medical advice.</p></article>
        </div>
        <Link data-reveal href="/privacy" className="trust-link">Read the full privacy approach <ArrowRight size={16} /></Link>
      </section>

      <section className="landing-final">
        <div data-reveal>
          <span className="landing-final-mark"><Moon aria-hidden="true" size={28} /></span>
          <p>Start building a clearer picture tonight</p>
          <h2>More understanding.<br />Less second-guessing.</h2>
          <Link href="/login" className="landing-primary">Continue with Google <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="landing-footer"><div className="landing-footer-brand"><span>Sommeil</span><small>Adaptive sleep intelligence for families.</small></div><div><Link href="/how-it-works">Product</Link><Link href="/sleep-guide">Sleep guide</Link><Link href="/docs/mcp">ChatGPT & MCP</Link><Link href="/privacy">Privacy</Link><span>© 2026 Sommeil</span></div></footer>
    </main>
  )
}
