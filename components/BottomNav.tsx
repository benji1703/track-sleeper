'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ChartNoAxesCombined, History, Moon, Settings } from 'lucide-react'

const ITEMS = [
  { href: '/track', label: 'Now', icon: Moon },
  { href: '/history', label: 'Timeline', icon: History },
  { href: '/insights', label: 'Insights', icon: ChartNoAxesCombined },
  { href: '/settings', label: 'Family', icon: Settings },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex min-h-[62px] flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors',
                active ? 'text-sage' : 'text-muted'
              )}
            >
              <span className="bottom-nav-icon"><Icon aria-hidden="true" size={20} strokeWidth={active ? 2.4 : 1.8} /></span>
              <span className="text-[11px] font-medium">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
