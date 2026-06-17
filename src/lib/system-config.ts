import { createServiceClient } from '@/lib/supabase/service'

let _cache: Record<string, string> | null = null
let _cacheAt = 0
const TTL = 30_000

export async function getSystemConfig(key: string): Promise<string | null> {
  try {
    const now = Date.now()
    if (!_cache || now - _cacheAt > TTL) {
      const supa = createServiceClient()
      const { data } = await supa.from('system_config').select('key, value')
      _cache = {}
      for (const row of (data ?? []) as { key: string; value: string }[]) {
        _cache[row.key] = row.value ?? ''
      }
      _cacheAt = now
    }
    return _cache[key] ?? null
  } catch {
    return null
  }
}

export async function getAllSystemConfig(): Promise<Record<string, string>> {
  try {
    await getSystemConfig('__warm__')
    return { ...(_cache ?? {}) }
  } catch {
    return {}
  }
}

export async function setSystemConfig(key: string, value: string): Promise<void> {
  const supa = createServiceClient()
  await supa.from('system_config').upsert({ key, value, updated_at: new Date().toISOString() })
  if (_cache) _cache[key] = value
}
