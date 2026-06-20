'use client'

/**
 * Instrumentasi sementara untuk audit performance - bukan untuk production.
 * Ukur waktu dari klik <a> sampai konten halaman tujuan ter-mount di client
 * (bukan cuma waktu render server). Hasilnya dikirim ke /api/_perf supaya
 * muncul di log server, tidak perlu user salin dari console browser.
 */

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function RoutePerfTracker() {
  const pathname = usePathname()
  const clickedAt = useRef<{ path: string; t: number } | null>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const a = (e.target as HTMLElement)?.closest('a')
      const href = a?.getAttribute('href')
      if (!href || !href.startsWith('/')) return
      let path: string
      try { path = new URL(href, window.location.origin).pathname } catch { return }
      clickedAt.current = { path, t: performance.now() }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    const click = clickedAt.current
    if (!click || click.path !== pathname) return
    const ms = Math.round(performance.now() - click.t)
    clickedAt.current = null
    fetch('/api/perf-log', {
      method:    'POST',
      headers:   { 'Content-Type': 'application/json' },
      body:      JSON.stringify({ path: pathname, ms }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
