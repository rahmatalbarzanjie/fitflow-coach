import { z } from 'zod'

export const paymentProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
})

export type PaymentProfileFormData = z.infer<typeof paymentProfileSchema>

export const paymentMethodSchema = z.object({
  method_type:    z.enum(['bank', 'qris']),
  bank_name:      z.string().optional(),
  account_number: z.string().optional(),
  account_name:   z.string().optional(),
})

export type PaymentMethodFormData = z.infer<typeof paymentMethodSchema>
