import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        orange: '#F37021',
        cream: '#FAF6F0',
        ink: '#1A1A1A',
        sand: '#E8E0D5',
        sage: '#9CA88E',
      },
      fontFamily: {
        // Self-hosted via next/font (see app/layout.tsx) — matches the
        // typography used at rsvp.arbibe.dev (mili-rsvp).
        serif: ['var(--font-serif)', '"Frank Ruhl Libre"', 'serif'],
        sans: ['var(--font-sans)', 'Assistant', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
