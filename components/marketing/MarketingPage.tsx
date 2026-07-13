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
        <h2>Understand tonight. Learn from tomorrow.</h2>
        <Link href="/login">Start tracking <ArrowRight size={18} /></Link>
      </section>
      <footer className="landing-footer"><div className="landing-footer-brand"><span>Sommeil</span><small>Adaptive sleep intelligence for families.</small></div><div><Link href="/how-it-works">Product</Link><Link href="/sleep-guide">Sleep guide</Link><Link href="/docs/mcp">ChatGPT & MCP</Link><Link href="/privacy">Privacy</Link><span>© 2026 Sommeil</span></div></footer>
    </main>
  )
}
