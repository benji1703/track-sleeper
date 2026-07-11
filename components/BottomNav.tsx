'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const ITEMS = [
  { href: '/', label: 'Track' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
] as const

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/15 bg-cream/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1.5 py-2"
            >
              <span
                className={clsx(
                  'h-1.5 w-1.5 rounded-full transition-colors',
                  active ? 'bg-orange' : 'bg-transparent'
                )}
              />
              <span
                className={clsx(
                  'text-[11px] tracking-[0.2em] uppercase transition-colors',
                  active ? 'text-orange' : 'text-ink/50'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
