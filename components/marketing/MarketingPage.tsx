import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import PublicHeader from '@/components/marketing/PublicHeader'

export default function MarketingPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  children: React.ReactNode
}) {
  return (
    <main className="marketing-page">
      <PublicHeader />
      <header className="marketing-title">
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <div>{intro}</div>
      </header>
      <div className="marketing-content">{children}</div>
      <section className="marketing-cta">
        <h2>Keep the night simple.</h2>
        <Link href="/login">Start tracking <ArrowRight size={18} /></Link>
      </section>
      <footer className="landing-footer"><span>Sommeil</span><div><Link href="/privacy">Privacy</Link><Link href="/sleep-guide">Sleep guide</Link><span>2026</span></div></footer>
    </main>
  )
}
