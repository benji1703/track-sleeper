import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sommeil Sleep Tracker',
    short_name: 'Sommeil',
    description: "Adaptive sleep intelligence for families.",
    id: '/track',
    start_url: '/track',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F3EE',
    theme_color: '#F5F3EE',
    categories: ['health', 'lifestyle'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Track sleep', short_name: 'Track', url: '/track', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] },
      { name: 'View timeline', short_name: 'Timeline', url: '/history', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }] },
    ],
  }
}
