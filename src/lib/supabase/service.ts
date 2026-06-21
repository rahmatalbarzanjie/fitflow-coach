import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Service-role client - bypasses RLS. Only use in server-side API routes.
export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      // PostgREST fetch dari supabase-js TIDAK otomatis ikut default
      // no-store walaupun halaman pakai `export const dynamic =
      // 'force-dynamic'` - kalau library set opsi cache sendiri, Next.js
      // Data Cache tetap bisa nyimpen hasil lama (termasuk hasil kosong
      // sebelum ada data) dan menyajikannya lagi walau server di-restart.
      // Dipaksa no-store di level client supaya tidak ada query yang
      // pernah "macet" di hasil basi.
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  )
}
