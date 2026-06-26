'use client'

import { useController, type Control } from 'react-hook-form'
import type { ClassFormData } from '@/lib/validations/class'

interface Props {
  control: Control<ClassFormData>
}

const OPTIONS: { value: ClassFormData['payment_methods_enabled']; label: string }[] = [
  { value: 'ots_only',      label: 'OTS saja' },
  { value: 'transfer_only', label: 'Transfer saja' },
  { value: 'both',          label: 'Keduanya' },
]

// Dipakai NewClassForm & ClassEditForm - mengontrol metode mana yang
// ditawarkan ke peserta saat daftar (terpisah dari Payment Profile, yang
// cuma menentukan TUJUAN transfernya).
export function PaymentMethodsEnabledPicker({ control }: Props) {
  const { field } = useController({ control, name: 'payment_methods_enabled', defaultValue: 'both' })

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        Metode Pembayaran
        <span className="text-gray-400 font-normal ml-1 text-xs">(yang ditawarkan ke peserta)</span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => field.onChange(opt.value)}
            className={`h-9 rounded-lg text-xs font-medium border transition-colors ${
              field.value === opt.value
                ? 'bg-violet-600 border-violet-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
