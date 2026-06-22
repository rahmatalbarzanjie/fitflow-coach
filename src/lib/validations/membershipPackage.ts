import { z } from 'zod'

// Input kosong dari <input type="number"> dikirim sebagai string '' -
// Number('') adalah 0 (bukan NaN/undefined), jadi tanpa preprocess ini
// field "opsional" akan gagal validasi .positive() secara diam-diam
// setiap kali dikosongkan.
const optionalPositiveInt = z.preprocess(
  val => (val === '' || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().positive().optional()
)

export const membershipPackageSchema = z.object({
  name:           z.string().min(2, 'Nama minimal 2 karakter'),
  package_type:   z.enum(['unlimited', 'session_pack']),
  class_type:     z.enum(['zumba', 'yoga', 'pilates', 'poundfit', 'aerobic', 'barre', 'other']).optional().or(z.literal('')),
  total_sessions: optionalPositiveInt,
  duration_days:  optionalPositiveInt,
  price:          z.coerce.number().min(0).default(0),
  payment_profile_id: z.string().optional().or(z.literal('')),
})

export type MembershipPackageFormData = z.infer<typeof membershipPackageSchema>
