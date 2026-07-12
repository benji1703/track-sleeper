import type { Metadata, Viewport } from 'next'
import { Frank_Ruhl_Libre, Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import './globals.css'

// Frank Ruhl Libre — the elegant editorial serif rsvp.arbibe.dev falls back
// to for Latin text; used here directly since this app is English-only.
const frankRuhlLibre = Frank_Ruhl_Libre({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-serif',
  display: 'swap',
})

// Inter — closest clean, geometric Google Font to iOS's SF Pro for UI text.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sommeil',
  description: 'A quiet way to track your baby\'s sleep.',
  applicationName: 'Sommeil',
  manifest: '/manifest.webmanifest',
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sommeil',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F3EE',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${frankRuhlLibre.variable} ${inter.variable}`}>
      <body className="bg-cream text-ink font-sans min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
