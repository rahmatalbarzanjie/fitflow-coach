import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/wa/queue-health
 * Auth diverifikasi via createClient(), query DB via createServiceClient()
 * untuk menghindari RLS SELECT yang memfilter semua baris ketika auth.uid()
 * tidak terinisialisasi dengan benar di Next.js Route Handler.
 */
export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const [queuedRes, processingRes, failedRes, retryingRes, recoveredRes, maxAttemptsRes] =
    await Promise.all([
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'queued'),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'processing'),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'failed'),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('status', 'queued').gt('attempts', 0),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('last_error_code', 'RECOVERED_FROM_TIMEOUT')
        .gte('created_at', new Date(Date.now() - 7*86400_000).toISOString()),
      (supabase.from('wa_outbox') as any).select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('last_error_code', 'MAX_ATTEMPTS_REACHED')
        .gte('created_at', new Date(Date.now() - 7*86400_000).toISOString()),
    ])

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
    queued:                  queuedRes.count     ?? 0,
    processing:              processingRes.count ?? 0,
    failed:                  failedRes.count     ?? 0,
    retrying:                retryingRes.count   ?? 0,
    recovered_from_timeout:  recoveredRes.count  ?? 0,
    max_attempts_reached:    maxAttemptsRes.count ?? 0,
    top_url_messages:        topUrlMessages ?? [],
  })
}
