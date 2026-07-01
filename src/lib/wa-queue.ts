import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

export type WaMessageType =
  | 'registration'
  | 'event'
  | 'reminder'
  | 'broadcast'
  | 'community'
  | 'chatbot'
  | 'feedback'
  | 'manual'
  | 'system'

export interface EnqueueParams {
  supabase:      SupabaseClient
  userId:        string
  phone?:        string
  groupId?:      string
  message:       string
  fonnteToken:   string
  messageType:   WaMessageType
  contactName?:  string
  sourceRoute:   string
  delaySeconds?: number
  scheduledAt?:  Date
  botPhone?:     string
}

// Shared helper - also used by process-queue/route.ts
export function envInt(key: string, fallback: number): number {
  const v = process.env[key]
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function detectUrls(text: string): { contains: boolean; count: number } {
  const matches = text.match(/https?:\/\/\S+/g)
  const count   = matches?.length ?? 0
  return { contains: count > 0, count }
}

/**
 * Masukkan pesan ke wa_outbox untuk dikirim oleh worker process-queue.
 *
 * Smart scheduling: kalau jumlah pesan queued/processing untuk user_id ini
 * sudah >= WA_QUEUE_MAX_BURST, scheduled_at digeser ke setelah pesan
 * terakhir yang sudah terjadwal + WA_QUEUE_BURST_DELAY_MS. Ini mencegah
 * burst (misalnya broadcast 100 member sekaligus) menjadi 100 request Fonnte
 * dalam satu batch - pesan otomatis tersebar dengan jeda yang aman.
 *
 * Returns: id baris outbox yang dibuat, atau null jika INSERT gagal.
 * Kegagalan selalu dicatat ke wa_message_log via service client.
 */
export async function enqueueWhatsApp(params: EnqueueParams): Promise<string | null> {
  const {
    supabase, userId, phone, groupId, message, fonnteToken,
    messageType, contactName, sourceRoute, delaySeconds, scheduledAt, botPhone,
  } = params

  if (!phone && !groupId) {
    console.warn('[wa-queue] enqueueWhatsApp dipanggil tanpa phone maupun groupId')
    return null
  }

  // Smart scheduling: deteksi burst dan offset scheduled_at jika perlu
  const resolvedScheduledAt = scheduledAt
    ? scheduledAt
    : await resolveScheduledAt(supabase, userId)

  const { data, error } = await (supabase
    .from('wa_outbox') as any)
    .insert({
      user_id:         userId,
      target_phone:    phone   ?? null,
      target_group_id: groupId ?? null,
      message,
      fonnte_token:    fonnteToken,
      message_type:    messageType,
      contact_name:    contactName ?? null,
      source_route:    sourceRoute,
      delay_seconds:   delaySeconds ?? null,
      scheduled_at:    resolvedScheduledAt.toISOString(),
      bot_phone:       botPhone ?? null,
    })
    .select('id')
    .single()

  if (error) {
    const errMsg = `Gagal INSERT ke wa_outbox: ${error.message}`
    console.error(`[wa-queue] ${errMsg}`)
    logEnqueueFailure({
      userId,
      phone:        phone ?? groupId ?? 'unknown',
      contactName:  contactName ?? null,
      message,
      messageType,
      sourceRoute,
      botPhone:     botPhone ?? null,
      errorMessage: errMsg,
    }).catch(() => {})
    return null
  }

  return (data as any).id as string
}

/**
 * Hitung scheduled_at yang tepat untuk pesan baru.
 * Kalau jumlah pesan queued/processing untuk user ini >= WA_QUEUE_MAX_BURST,
 * pesan baru dijadwalkan setelah pesan terjadwal terakhir + WA_QUEUE_BURST_DELAY_MS.
 * Kalau tidak burst, dijadwalkan sekarang.
 */
async function resolveScheduledAt(supabase: SupabaseClient, userId: string): Promise<Date> {
  const maxBurst   = envInt('WA_QUEUE_MAX_BURST',      3)
  const burstDelay = envInt('WA_QUEUE_BURST_DELAY_MS', 12_000)

  const { count } = await (supabase
    .from('wa_outbox') as any)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['queued', 'processing'])

  if ((count ?? 0) < maxBurst) {
    return new Date()
  }

  // Burst terdeteksi - ambil scheduled_at terbesar untuk user ini dan offset
  const { data: latest } = await (supabase
    .from('wa_outbox') as any)
    .select('scheduled_at')
    .eq('user_id', userId)
    .in('status', ['queued', 'processing'])
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.scheduled_at) {
    return new Date(new Date(latest.scheduled_at).getTime() + burstDelay)
  }
  return new Date()
}

async function logEnqueueFailure(params: {
  userId:       string
  phone:        string
  contactName:  string | null
  message:      string
  messageType:  WaMessageType
  sourceRoute:  string
  botPhone:     string | null
  errorMessage: string
}): Promise<void> {
  const service = createServiceClient()
  const { contains, count } = detectUrls(params.message)

  await (service.from('wa_message_log') as any).insert({
    user_id:         params.userId,
    contact_phone:   params.phone,
    contact_name:    params.contactName,
    direction:       'outbound',
    message_type:    params.messageType,
    message_content: params.message,
    contains_url:    contains,
    url_count:       count,
    character_count: params.message.length,
    source_route:    params.sourceRoute,
    success:         false,
    error_message:   params.errorMessage,
    bot_phone:       params.botPhone,
  })
}

export interface LogDirectParams {
  userId:             string
  contactPhone:       string
  contactName?:       string
  direction:          'outbound' | 'inbound'
  messageType:        WaMessageType
  messageContent:     string
  sourceRoute:        string
  success:            boolean
  errorMessage?:      string
  sentAt?:            Date
  receivedAt?:        Date
  botPhone?:          string
  providerMessageId?: string
  outboxId?:          string
  queueDelaySeconds?: number
}

/**
 * Log satu pesan langsung ke wa_message_log (tanpa lewat outbox).
 * Dipakai oleh wa/incoming untuk chatbot replies dan pesan inbound.
 * Non-blocking: panggil dengan .catch(() => {}) dari caller.
 */
export async function logWhatsAppDirect(params: LogDirectParams): Promise<void> {
  const service = createServiceClient()
  const { contains, count } = detectUrls(params.messageContent)

  await (service.from('wa_message_log') as any).insert({
    user_id:             params.userId,
    contact_phone:       params.contactPhone,
    contact_name:        params.contactName ?? null,
    direction:           params.direction,
    message_type:        params.messageType,
    message_content:     params.messageContent,
    contains_url:        contains,
    url_count:           count,
    character_count:     params.messageContent.length,
    source_route:        params.sourceRoute,
    success:             params.success,
    error_message:       params.errorMessage ?? null,
    sent_at:             params.sentAt?.toISOString() ?? (params.direction === 'outbound' && params.success ? new Date().toISOString() : null),
    received_at:         params.receivedAt?.toISOString() ?? (params.direction === 'inbound' ? new Date().toISOString() : null),
    bot_phone:           params.botPhone ?? null,
    provider_message_id: params.providerMessageId ?? null,
    outbox_id:           params.outboxId ?? null,
    queue_delay_seconds: params.queueDelaySeconds ?? null,
  })
}
