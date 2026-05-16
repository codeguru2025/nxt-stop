import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NXT STOP',
    short_name: 'NXT STOP',
    description: "Zimbabwe's premium nightlife events.",
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#8B5CF6',
    orientation: 'portrait',
    icons: [
      {
        src: 'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: 'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png',
        sizes: '512x512',
        type: 'image/jpeg',
        purpose: 'maskable',
      },
    ],
  }
}
