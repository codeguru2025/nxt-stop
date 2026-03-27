import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'NXT STOP', template: '%s | NXT STOP' },
  description: 'Premium nightlife and DJ events. Secure tickets, real-time entry, and exclusive experiences.',
  keywords: ['events', 'nightlife', 'DJ', 'tickets', 'Zimbabwe', 'NXT STOP'],
  openGraph: {
    title: 'NXT STOP',
    description: 'Premium nightlife and DJ events.',
    type: 'website',
  },
}

export const viewport = {
  themeColor: '#8B5CF6',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">{children}</body>
    </html>
  )
}
