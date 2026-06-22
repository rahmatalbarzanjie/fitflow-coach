'use client'

/**
 * ClassSettingsForm — wrapper client untuk ClassEditForm di /settings.
 * Diperlukan karena ClassEditForm butuh onClose (fungsi) yang
 * tidak bisa di-pass dari server component.
 */

import { useRouter } from 'next/navigation'
import { ClassEditForm } from '@/components/classes/ClassEditForm'

interface Props {
  cls: any
  classId: string
  paymentProfiles?: { id: string; name: string }[]
}

export function ClassSettingsForm({ cls, classId, paymentProfiles }: Props) {
  const router = useRouter()

  return (
    <ClassEditForm
      cls={cls}
      paymentProfiles={paymentProfiles}
      inModal={false}
      redirectTo={`/classes/${classId}`}
    />
  )
}
