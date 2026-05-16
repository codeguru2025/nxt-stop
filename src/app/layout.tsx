import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import PWAInstallPrompt from '@/components/PWAInstallPrompt'
import CsrfProvider from '@/components/CsrfProvider'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'NXT STOP', template: '%s | NXT STOP' },
  description: "Zimbabwe's premium nightlife events. The artists. The energy. The culture.",
  keywords: ['events', 'nightlife', 'DJ', 'tickets', 'Zimbabwe', 'NXT STOP', 'Bulawayo', 'Harare'],
  verification: {
    other: {
      'facebook-domain-verification': 'mryx0l0dbixq7ik0sf0fxsek5o97lt',
    },
  },
  icons: {
    icon: 'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png',
    apple: 'https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png',
  },
  openGraph: {
    title: 'NXT STOP',
    description: "Zimbabwe's premium nightlife events.",
    type: 'website',
    images: ['https://nxtstop-uploads.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo%20new.png'],
  },
}

export const viewport = {
  themeColor: '#8B5CF6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen min-h-dvh flex flex-col antialiased">
        <div className="flex flex-col flex-1 min-h-0 max-md:pb-[env(safe-area-inset-bottom)]">
          {children}
        </div>
        <CsrfProvider />
        <PWAInstallPrompt />
      </body>
    </html>
  )
}
