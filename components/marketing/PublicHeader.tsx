import Link from 'next/link'
import { Moon } from 'lucide-react'
import AppearanceToggle from '@/components/marketing/AppearanceToggle'

export default function PublicHeader({ inverse = false }: { inverse?: boolean }) {
  return (
    <header className="public-header">
      <Link href="/" className="public-brand" aria-label="Sommeil home">
        <Moon aria-hidden="true" size={18} strokeWidth={2} />
        <span>Sommeil</span>
      </Link>
      <nav aria-label="Public navigation" className="public-links">
        <Link href="/how-it-works">Product</Link>
        <Link href="/docs/mcp">ChatGPT</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <div className="public-actions">
        <AppearanceToggle />
        <Link href="/login" className={inverse ? 'public-login public-login-light' : 'public-login'}>
          Sign in
        </Link>
      </div>
    </header>
  )
}
