import { NextResponse } from 'next/server'

/**
 * Sink log untuk RoutePerfTracker (audit performance sementara).
 * Tidak menyentuh database, cuma console.log supaya gampang dibaca dari log dev server.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (body?.path) {
    console.log(`nav:click-to-render ${body.path}: ${body.ms}ms`)
  }
  return NextResponse.json({ ok: true })
}
