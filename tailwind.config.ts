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
        // ui-serif resolves to New York on Apple platforms — Apple's screen
        // serif with clean lining numerals (primary target: iPhone Safari).
        serif: ['ui-serif', '"New York"', 'Georgia', '"Times New Roman"', 'serif'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
