'use client'

import { useState, useEffect } from 'react'

export function PublicNavbar({ studio }: { studio: string }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-4 md:px-10 transition-all duration-300 ${
        scrolled ? 'bg-white/80 backdrop-blur-lg shadow-sm' : 'bg-transparent'
      }`}
    >
      <div className="font-montserrat text-2xl font-bold text-on-surface md:text-indigo-700"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
        {studio}
      </div>
      <nav className="hidden md:flex gap-8">
        <a
          href="#schedules"
          onClick={scrollTo('schedules')}
          className="text-on-surface font-bold border-b-2 border-indigo-700 pb-1 text-sm"
        >
          Schedules
        </a>
        <a
          href="#events"
          onClick={scrollTo('events')}
          className="text-on-surface/80 font-medium hover:text-indigo-700 transition-colors pb-1 text-sm"
        >
          Events
        </a>
        <a
          href="#benefits"
          onClick={scrollTo('benefits')}
          className="text-on-surface/80 font-medium hover:text-indigo-700 transition-colors pb-1 text-sm"
        >
          Benefits
        </a>
      </nav>
    </header>
  )
}
