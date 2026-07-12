'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, BellRing, ChartNoAxesCombined, Check, Moon, Sparkles } from 'lucide-react'
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
            <p data-hero-copy className="landing-kicker">Baby sleep, gently understood</p>
            <h1 data-hero-copy>Sommeil</h1>
            <p data-hero-copy className="landing-lede">
              One tap when sleep starts. One tap when it ends. A calmer rhythm for nights when
              thinking is the last thing you need.
            </p>
            <div data-hero-copy className="landing-actions">
              <Link href="/login" className="landing-primary">
                Start tracking <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <Link href="/how-it-works" className="landing-secondary">See how it works</Link>
            </div>
          </div>

          <div className="phone-stage" aria-label="Sommeil app preview">
            <div ref={phone} data-phone data-float className="iphone-shell">
              <div className="iphone-island" />
              <div className="iphone-screen">
                <div data-phone-ui className="phone-status"><span>9:41</span><span>5G&nbsp;&nbsp;96%</span></div>
                <div data-phone-ui className="phone-heading">
                  <span>Mila</span>
                  <strong>Awake</strong>
                </div>
                <div data-phone-ui className="phone-focus">
                  <span className="phone-chip"><Sparkles size={12} /> Tired soon</span>
                  <small>Likely sleepy around</small>
                  <strong>19:40</strong>
                  <button type="button" tabIndex={-1}>Wake window 2h–3h</button>
                </div>
                <div data-phone-ui className="phone-segment"><span>Nap</span><span>Night</span></div>
                <div data-phone-ui className="phone-start">Start nap</div>
                <div data-phone-ui className="phone-today">
                  <span>Today</span>
                  <div><i /><i /><i /></div>
                  <footer><b>3h 42m slept</b><b>2 naps</b></footer>
                </div>
                <div className="phone-home-indicator" />
              </div>
            </div>
          </div>
        </div>
        <a href="#rhythm" className="landing-scroll-cue">Scroll to explore</a>
      </section>

      <section id="rhythm" className="landing-band landing-rhythm">
        <div className="landing-section-heading" data-reveal>
          <p>Built for 3 a.m.</p>
          <h2>Less to remember.<br />More to notice.</h2>
        </div>
        <div className="rhythm-list">
          <article data-reveal><Moon /><span>01</span><h3>Track in one tap</h3><p>The primary action stays large, contextual, and reachable with one hand.</p></article>
          <article data-reveal><BellRing /><span>02</span><h3>Know what comes next</h3><p>Personalized wake windows learn from your baby’s actual rhythm.</p></article>
          <article data-reveal><ChartNoAxesCombined /><span>03</span><h3>See patterns quietly</h3><p>Useful trends surface without turning sleep into another performance metric.</p></article>
        </div>
      </section>

      <section className="landing-band landing-story">
        <div className="story-copy" data-reveal>
          <p>From fragments to rhythm</p>
          <h2>A whole day, readable in a glance.</h2>
          <p>Shared tracking keeps every caregiver on the same timeline, while daily totals and sleep stretches stay easy to scan.</p>
          <Link href="/sleep-guide">Explore the sleep guide <ArrowRight size={17} /></Link>
        </div>
        <div className="story-visual" data-reveal>
          <div className="story-day"><span>6 PM</span><span>Midnight</span><span>6 AM</span></div>
          <div className="story-line"><i data-timeline-fill /></div>
          <div className="story-metrics"><div><small>Total sleep</small><strong>12h 48m</strong></div><div><small>Longest stretch</small><strong>6h 22m</strong></div></div>
        </div>
      </section>

      <section className="landing-band landing-trust">
        <div data-reveal>
          <Check aria-hidden="true" />
          <h2>Private by design.</h2>
          <p>Your family’s data stays behind authenticated access. Shared caregivers only see the baby they were invited to.</p>
          <Link href="/privacy">Read our privacy approach</Link>
        </div>
      </section>

      <section className="landing-final">
        <div data-reveal>
          <Moon aria-hidden="true" size={34} />
          <h2>A quieter night starts here.</h2>
          <Link href="/login" className="landing-primary">Continue with Google <ArrowRight size={18} /></Link>
        </div>
      </section>

      <footer className="landing-footer"><span>Sommeil</span><div><Link href="/privacy">Privacy</Link><Link href="/sleep-guide">Sleep guide</Link><span>2026</span></div></footer>
    </main>
  )
}
