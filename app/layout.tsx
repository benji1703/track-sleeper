import type { Metadata, Viewport } from 'next'
import { Noto_Serif_Hebrew, Heebo } from 'next/font/google'
import Providers from '@/components/Providers'
import './globals.css'

const notoSerifHebrew = Noto_Serif_Hebrew({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-serif',
  display: 'swap',
})

const heebo = Heebo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Track Sleeper',
  description: 'A quiet way to track your baby\'s sleep.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Sleeper',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#FAF6F0',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${notoSerifHebrew.variable} ${heebo.variable}`}>
      <body className="bg-cream text-ink font-sans min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
