'use client'

import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-14">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-ink/50">
            A quiet way to track sleep
          </p>
          <h1 className="font-serif text-5xl italic text-ink">Sommeil</h1>
        </div>

        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-lg border border-ink/15 bg-white/30 px-6 text-[15px] font-medium text-ink transition-colors active:bg-ink/5"
        >
          <GoogleGlyph />
          <span className="tracking-[0.02em]">Continue with Google</span>
        </button>

        <p className="text-xs text-ink/35">Track Sleeper</p>
      </div>
    </main>
  )
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 01-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 009 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7a5.4 5.4 0 010-3.4V4.97H.9a9 9 0 000 8.06l3.05-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 00.9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  )
}
