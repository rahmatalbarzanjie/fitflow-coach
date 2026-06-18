import { z } from 'zod'

// Input kosong dari <input type="number"> dikirim sebagai string '' —
// Number('') adalah 0 (bukan NaN/undefined), jadi tanpa preprocess ini
// field "opsional" akan gagal validasi .positive() secara diam-diam
// setiap kali dikosongkan (submit tidak terjadi, tanpa pesan error apa pun).
const optionalPositiveInt = z.preprocess(
  val => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().positive().optional()
)

export const classSchema = z.object({
  name:               z.string().min(2, 'Nama minimal 2 karakter'),
  type:               z.enum(['zumba', 'yoga', 'pilates', 'poundfit', 'aerobic', 'barre', 'other']),
  day_of_week:        z.coerce.number().int().min(0).max(6),
  start_time:         z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  end_time:           z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  location:           z.string().optional(),
  capacity:           optionalPositiveInt,
  description:        z.string().optional(),
  class_price:        z.coerce.number().min(0).optional().nullable(),
  revenue_share_pct:  z.coerce.number().int().min(0).max(100).default(50),
  show_registrations: z.boolean().default(false),
})

export type ClassFormData = z.infer<typeof classSchema>
