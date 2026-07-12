import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sommeil Sleep Tracker',
    short_name: 'Sommeil',
    description: "A quiet way to track your baby's sleep.",
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F3EE',
    theme_color: '#F5F3EE',
  }
}
