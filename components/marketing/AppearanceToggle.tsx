'use client'

import { Moon, Sun } from 'lucide-react'

type ResolvedAppearance = 'light' | 'dark'

function resolvedAppearance(): ResolvedAppearance {
  const saved = localStorage.getItem('sommeil:appearance')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function AppearanceToggle() {
  function toggleAppearance() {
    const appearance = resolvedAppearance()
    const next = appearance === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.appearance = next
    localStorage.setItem('sommeil:appearance', next)
  }

  return (
    <button type="button" className="appearance-toggle" onClick={toggleAppearance} aria-label="Toggle color theme" title="Toggle color theme">
      <Sun className="appearance-sun" aria-hidden="true" size={16} />
      <Moon className="appearance-moon" aria-hidden="true" size={16} />
    </button>
  )
}
