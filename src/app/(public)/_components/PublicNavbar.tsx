'use client'

import { useState, useEffect } from 'react'

interface Props {
  hasTestimonials?: boolean
}

export function PublicNavbar({ hasTestimonials = false }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    setMobileOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navLinks = [
    { id: 'schedules', label: 'Jadwal' },
    { id: 'events',    label: 'Events' },
    { id: 'benefits',  label: 'Member' },
    ...(hasTestimonials ? [{ id: 'testimonials', label: 'Testimoni' }] : []),
  ]

  return (
    <>
      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? 'bg-white/90 backdrop-blur-lg shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="flex justify-end items-center px-5 py-4 md:px-10">
          {/* Desktop nav */}
          <nav className="hidden md:flex gap-8">
            {navLinks.map((link, i) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={scrollTo(link.id)}
                className={`text-sm font-medium pb-1 transition-colors ${
                  i === 0
                    ? 'text-on-surface font-bold border-b-2 border-indigo-700'
                    : 'text-on-surface/70 hover:text-indigo-700'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 -mr-2"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Menu"
          >
            <span className={`block w-6 h-0.5 bg-on-surface transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-on-surface transition-all duration-300 ${mobileOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-on-surface transition-all duration-300 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileOpen ? 'max-h-60' : 'max-h-0'}`}>
          <div className="flex flex-col px-5 pb-4 gap-1">
            {navLinks.map(link => (
              <a
                key={link.id}
                href={`#${link.id}`}
                onClick={scrollTo(link.id)}
                className="py-3 text-base font-semibold text-on-surface border-b border-outline-variant/40 last:border-0"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </header>
    </>
  )
}
