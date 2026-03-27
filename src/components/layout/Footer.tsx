import Link from 'next/link'
import { Facebook, Instagram, Youtube, Mail, Phone } from 'lucide-react'

const SOCIALS = [
  { icon: Facebook,  href: 'https://www.facebook.com/share/18TBJBkjzL/?mibextid=wwXIfr', label: 'Facebook' },
  { icon: Instagram, href: 'https://www.instagram.com/nxtstop_zw?igsh=OWI5OHBoY3J2OTZt', label: 'Instagram' },
  { icon: Youtube,   href: 'https://youtube.com/@nxtstopsessions?si=Aba1DlP7Fn551Fv5', label: 'YouTube' },
]

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] border-t border-[#1a1a1a] mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
                <span className="text-white font-black text-sm">N</span>
              </div>
              <span className="font-black text-xl text-white">NXT <span className="text-purple-500">STOP</span></span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              The premium event technology platform powering Zimbabwe's best nightlife experiences.
            </p>
            <div className="flex gap-3 mt-6">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-9 h-9 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-gray-500 hover:text-purple-400 hover:border-purple-500/30 transition-all"
                >
                  <Icon size={16} />
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
              {['Events', 'Tickets', 'Partners', 'Virtual Events', 'Rewards'].map(l => (
                <li key={l}>
                  <Link href={`/${l.toLowerCase().replace(' ', '-')}`} className="text-gray-500 hover:text-white text-sm transition-colors">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-2">
              {['About', 'Contact', 'Terms', 'Privacy'].map(l => (
                <li key={l}>
                  <Link href={`/${l.toLowerCase()}`} className="text-gray-500 hover:text-white text-sm transition-colors">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1a1a1a] mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-gray-600 text-sm">
            © {new Date().getFullYear()} NXT STOP. All rights reserved.
          </p>
          <p className="text-gray-700 text-xs">
            Powered by the NXT STOP Event Engine
          </p>
        </div>
      </div>
    </footer>
  )
}
