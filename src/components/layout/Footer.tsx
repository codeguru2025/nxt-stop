import Link from 'next/link'
import { Mail, Phone } from 'lucide-react'

const SOCIALS = [
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/share/18TBJBkjzL/?mibextid=wwXIfr',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}>
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/nxtstop_zw?igsh=OWI5OHBoY3J2OTZt',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: 'https://youtube.com/@nxtstopsessions?si=Aba1DlP7Fn551Fv5',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={16} height={16}>
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" />
        <polygon fill="#0a0a0a" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" />
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-[#1a1a1a] mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-4">
              <img
                src="https://nxt-stop.lon1.cdn.digitaloceanspaces.com/nxt-stop%20logo.jpeg"
                alt="NXT STOP"
                className="h-10 w-auto object-contain"
              />
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              The premium event technology platform powering Zimbabwe's best nightlife experiences.
            </p>
            <div className="flex gap-3 mt-6">
              {SOCIALS.map(({ label, href, svg }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-purple-400 hover:border-purple-500/30 transition-all"
                >
                  {svg}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-5">
              <a href="mailto:nxtstop25@gmail.com" className="flex items-center gap-2 text-gray-500 hover:text-purple-400 text-sm transition-colors">
                <Mail size={14} />
                nxtstop25@gmail.com
              </a>
              <a href="tel:+263773316635" className="flex items-center gap-2 text-gray-500 hover:text-purple-400 text-sm transition-colors">
                <Phone size={14} />
                +263 773 316 635
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
          <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Platform</h4>
            <ul className="space-y-2">
              {[
                { label: 'Events', href: '/events' },
                { label: 'Tickets', href: '/dashboard/tickets' },
                { label: 'Rewards', href: '/dashboard/rewards' },
                { label: 'About', href: '/about' },
              ].map(l => (
                <li key={l.label}>
                  <Link href={l.href} className="text-gray-500 hover:text-white text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-gray-500 hover:text-white text-sm transition-colors">
                  About
                </Link>
              </li>
              <li>
                <a href="mailto:nxtstop25@gmail.com" className="text-gray-500 hover:text-white text-sm transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1a1a1a] mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} NXT STOP. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
