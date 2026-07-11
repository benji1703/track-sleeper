import type { Metadata, Viewport } from 'next'
import Providers from '@/components/Providers'
import './globals.css'

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
    <html lang="en">
      <body className="bg-cream text-ink min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
