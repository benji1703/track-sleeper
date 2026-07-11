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
        // Self-hosted via next/font (see app/layout.tsx). Frank Ruhl Libre
        // is the elegant editorial serif rsvp.arbibe.dev falls back to for
        // Latin text; Inter is a clean, iOS-SF-Pro-like sans for UI text.
        serif: ['var(--font-serif)', 'Georgia', '"Times New Roman"', 'serif'],
        sans: [
          'var(--font-sans)',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
