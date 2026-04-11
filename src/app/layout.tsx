import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import BottomNav from '@/components/layout/BottomNav'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'NXT STOP', template: '%s | NXT STOP' },
  description: "Zimbabwe's premium nightlife events. The artists. The energy. The culture.",
  keywords: ['events', 'nightlife', 'DJ', 'tickets', 'Zimbabwe', 'NXT STOP', 'Bulawayo', 'Harare'],
  icons: {
    icon: 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo.jpeg',
    apple: 'https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo.jpeg',
  },
  openGraph: {
    title: 'NXT STOP',
    description: "Zimbabwe's premium nightlife events.",
    type: 'website',
    images: ['https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo.jpeg'],
  },
}

export const viewport = {
  themeColor: '#8B5CF6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // allows content behind iOS home indicator
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen min-h-dvh flex flex-col antialiased">
        {/* Bottom padding on mobile to clear the fixed bottom nav */}
        <div className="flex flex-col flex-1 pb-safe md:pb-0">
          {children}
        </div>
        <BottomNav />
        <PWAInstallPrompt />
      </body>
    </html>
  )
}
