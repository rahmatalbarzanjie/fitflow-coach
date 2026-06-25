'use client'

import { forwardRef } from 'react'

// Pengganti <input type="time"> - format tampilan native (12h AM/PM vs 24h)
// ikut locale OS/browser pengguna (navigator.language), BUKAN atribut `lang`
// di halaman - dikonfirmasi langsung tidak bisa dipaksa lewat lang attribute.
// Instruktur tidak familiar dengan AM/PM, jadi input ini selalu tampil "HH:mm"
// apa pun pengaturan device-nya. Drop-in replacement: terima value "HH:mm"
// yang sama, kompatibel dengan {...register(...)} maupun value/onChange biasa.

function formatTimeDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length < 3) return digits
  let h = digits.slice(0, 2)
  const m = digits.slice(2)
  if (Number(h) > 23) h = '23'
  return m ? `${h}:${m}` : h
}

export const Time24Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Time24Input({ onChange, onBlur, placeholder, ...props }, ref) {
    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        maxLength={5}
        placeholder={placeholder ?? '00:00'}
        onChange={e => {
          e.target.value = formatTimeDigits(e.target.value)
          onChange?.(e)
        }}
        onBlur={e => {
          // Lengkapi menit jadi "00" kalau user berhenti tepat di belakang
          // jam (mis. cuma sempat ketik "08" lalu pindah field).
          const [h, m] = e.target.value.split(':')
          if (h && m === undefined) {
            e.target.value = `${h.padStart(2, '0')}:00`
            onChange?.(e)
          }
          onBlur?.(e)
        }}
      />
    )
  }
)
