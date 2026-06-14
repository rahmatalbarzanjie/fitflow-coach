import { z } from 'zod'

export const memberSchema = z.object({
  name:      z.string().min(2, 'Nama minimal 2 karakter'),
  phone:     z.string()
    .min(8, 'Nomor HP minimal 8 digit')
    .regex(/^[0-9+\-\s]+$/, 'Hanya angka, +, -, spasi'),
  notes:     z.string().optional(),
  address:   z.string().optional(),
  instagram: z.string().optional(),
})

export type MemberFormData = z.infer<typeof memberSchema>
