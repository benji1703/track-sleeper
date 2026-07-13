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
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F3EA' },
    { media: '(prefers-color-scheme: dark)', color: '#101715' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${frankRuhlLibre.variable} ${inter.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var a=localStorage.getItem('sommeil:appearance');if(a==='dark'||a==='light'||a==='automatic')document.documentElement.dataset.appearance=a}catch(e){}",
          }}
        />
      </head>
      <body className="bg-cream text-ink font-sans min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
