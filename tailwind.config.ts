import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Kept under the existing semantic names to avoid a noisy class
        // migration. The values form a low-glare evening palette.
        orange: '#C66A5A',
        cream: '#F5F3EE',
        ink: '#273238',
        sand: '#DDDCD4',
        sage: '#6E8B82',
      },
      fontFamily: {
        // Loaded through next/font in app/layout.tsx.
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
