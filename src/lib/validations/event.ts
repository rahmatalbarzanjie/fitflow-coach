import { z } from 'zod'

export const eventSchema = z.object({
  title:               z.string().min(3, 'Judul minimal 3 karakter'),
  slug:                z.string().min(2, 'Slug minimal 2 karakter')
                        .regex(/^[a-z0-9-]+$/, 'Hanya huruf kecil, angka, dan tanda -'),
  description:         z.string().optional(),
  event_date:          z.string().min(1, 'Pilih tanggal event'),
  start_time:          z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM'),
  end_time:            z.string().optional(),
  location:            z.string().optional(),
  // Pricing mode
  pricing_mode:        z.enum(['tiered', 'single']).default('tiered'),
  // Mode A — tiered
  tier1_label:         z.string().default('Gelombang 1'),
  tier1_price:         z.coerce.number().min(0).default(0),
  tier1_quota:         z.coerce.number().int().positive().optional().nullable(),
  tier2_label:         z.string().default('Gelombang 2'),
  tier2_price:         z.coerce.number().min(0).default(0),
  tier2_quota:         z.coerce.number().int().positive().optional().nullable(),
  // Mode B — single (maps to ots_price + max_capacity)
  ots_price:           z.coerce.number().min(0).default(0),
  max_capacity:        z.coerce.number().int().positive().optional().nullable(),
  // Bank info
  bank_name:           z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_account_name:   z.string().optional(),
  status:              z.enum(['draft', 'published', 'completed', 'cancelled']).default('draft'),
})

export type EventFormData = z.infer<typeof eventSchema>

export function toSlug(text: string): string {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
