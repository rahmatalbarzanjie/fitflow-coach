import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/wa/queue-health
 * Statistik kesehatan antrian WA untuk instruktur yang sedang login.
 * Dipakai oleh WaQueueHealth component di Message Center.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [queuedRes, processingRes, failedRes, retryingRes, recoveredRes, maxAttemptsRes] =
    await Promise.all([
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'queued'),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'processing'),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'failed'),
      // Retrying = queued dengan attempts > 0 (sudah pernah gagal, sedang menunggu retry)
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'queued').gt('attempts', 0),
      // Recovered from timeout - riwayat 7 hari
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('last_error_code', 'RECOVERED_FROM_TIMEOUT')
        .gte('created_at', new Date(Date.now() - 7*86400_000).toISOString()),
      // Max attempts reached - riwayat 7 hari
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('last_error_code', 'MAX_ATTEMPTS_REACHED')
        .gte('created_at', new Date(Date.now() - 7*86400_000).toISOString()),
    ])

  // Pesan dengan URL terbanyak - top 3 dari wa_message_log 7 hari terakhir
  const { data: topUrlMessages } = await (supabase
    .from('wa_message_log') as any)
    .select('contact_name, contact_phone, url_count, message_type, created_at')
    .eq('user_id', user.id)
    .eq('contains_url', true)
    .is('deleted_at', null)
    .gte('created_at', new Date(Date.now() - 7*86400_000).toISOString())
    .order('url_count', { ascending: false })
    .limit(3)

  return NextResponse.json({
    queued:       queuedRes.count     ?? 0,
    processing:   processingRes.count ?? 0,
    failed:       failedRes.count     ?? 0,
    retrying:     retryingRes.count   ?? 0,
    recovered_from_timeout: recoveredRes.count    ?? 0,
    max_attempts_reached:   maxAttemptsRes.count  ?? 0,
    top_url_messages: topUrlMessages ?? [],
  })
}
