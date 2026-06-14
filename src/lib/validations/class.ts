import { z } from 'zod'

export const classSchema = z.object({
  name:         z.string().min(2, 'Nama minimal 2 karakter'),
  type:         z.enum(['zumba', 'yoga', 'pilates', 'poundfit', 'aerobic', 'barre', 'other']),
  day_of_week:  z.coerce.number().int().min(0).max(6),
  start_time:   z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  end_time:     z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  location:     z.string().optional(),
  capacity:     z.coerce.number().int().positive().optional().nullable(),
  description:  z.string().optional(),
  payment_mode: z.enum(['free', 'cash', 'transfer']).default('free'),
  class_price:  z.coerce.number().min(0).optional().nullable(),
})

export type ClassFormData = z.infer<typeof classSchema>
