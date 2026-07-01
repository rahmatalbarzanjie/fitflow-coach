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
  // Kalau diisi, worker pakai nilai ini sebagai jeda sebelum kirim pesan ini.
  // Kalau null/undefined, worker pakai random 3-8 detik.
  delaySeconds?: number
  // Untuk scheduling masa depan (reminder). Default: sekarang (langsung antri).
  scheduledAt?:  Date
  botPhone?:     string
}

function detectUrls(text: string): { contains: boolean; count: number } {
  const matches = text.match(/https?:\/\/\S+/g)
  const count   = matches?.length ?? 0
  return { contains: count > 0, count }
}

/**
 * Masukkan pesan ke wa_outbox untuk dikirim oleh worker process-queue.
 * Business routes memanggil ini sebagai pengganti sendWhatsApp().
 * Tidak ada network call ke Fonnte di sini - hanya INSERT ke database.
 *
 * Returns: id baris outbox yang dibuat, atau null jika INSERT gagal.
 *
 * Saat gagal: error SELALU dicatat ke wa_message_log via service client
 * sehingga support dapat menginvestigasi tanpa bergantung pada caller
 * melakukan penanganan null. Caller tetap harus memeriksa null untuk
 * memutuskan apakah perlu melaporkan kegagalan ke pengguna.
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
      scheduled_at:    (scheduledAt ?? new Date()).toISOString(),
      bot_phone:       botPhone ?? null,
    })
    .select('id')
    .single()

  if (error) {
    const errMsg = `Gagal INSERT ke wa_outbox: ${error.message}`
    console.error(`[wa-queue] ${errMsg}`)

    // Log the failure to wa_message_log so it is observable by support
    // even if the caller does not handle the null return.
    // This uses the service client directly to ensure the write succeeds
    // regardless of the caller's auth context.
    logEnqueueFailure({
      userId,
      phone:       phone ?? groupId ?? 'unknown',
      contactName: contactName ?? null,
      message,
      messageType,
      sourceRoute,
      botPhone:    botPhone ?? null,
      errorMessage: errMsg,
    }).catch(() => {})

    return null
  }

  return (data as any).id as string
}

// Internal helper — not exported. Writes a failed-enqueue record to
// wa_message_log so support can always see that a send was attempted.
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
    // outbox_id is null: no outbox row was created
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
 * Dipakai oleh wa/incoming untuk chatbot replies (direct-send, latency-sensitive)
 * dan untuk pesan inbound dari peserta.
 * Non-blocking: panggil dengan .catch(() => {}) dari caller kalau tidak mau
 * gagalnya mempengaruhi response utama.
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
