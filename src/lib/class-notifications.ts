import { DAY_NAMES, formatDateShort, formatTime } from '@/lib/utils'

interface RescheduleParams {
  className:    string
  originalDay:  string
  originalTime: string
  newDate:      string   // ISO date YYYY-MM-DD
  newStartTime: string   // HH:MM
  newEndTime:   string
  location:     string
}

interface LocationParams {
  className:   string
  dayName:     string
  startTime:   string
  endTime:     string
  oldLocation: string
  newLocation: string
}

interface ExtraClassParams {
  className: string
  date:      string  // ISO date
  startTime: string
  endTime:   string
  location:  string
  capacity?: number | null
  notes?:    string
}

export function generateRescheduleMessage(p: RescheduleParams): string {
  const d       = new Date(p.newDate + 'T00:00:00')
  const dayNew  = DAY_NAMES[d.getDay()]
  const dateNew = formatDateShort(p.newDate)
  const loc     = p.location || 'Lokasi biasa'

  return `Hei kak! Ada info penting nih 🙏

Kelas ${p.className} yang biasanya ${p.originalDay} ${p.originalTime} minggu ini kita pindah ya:

📅 ${dayNew}, ${dateNew}
⏰ ${formatTime(p.newStartTime)} – ${formatTime(p.newEndTime)}
📍 ${loc} (tetap sama)

Maaf ya atas perubahannya 🙏
Sampai ketemu!`
}

export function generateLocationChangeMessage(p: LocationParams): string {
  return `Hei kak, ada perubahan lokasi untuk kelas ${p.className} ${p.dayName} ini ya! 📍

Bukan di ${p.oldLocation} seperti biasa, tapi pindah ke:
${p.newLocation}

Jam tetap ${formatTime(p.startTime)} – ${formatTime(p.endTime)} ya.
Sampai ketemu! 🙏`
}

export function generateExtraClassMessage(p: ExtraClassParams): string {
  const d       = new Date(p.date + 'T00:00:00')
  const dayName = DAY_NAMES[d.getDay()]
  const dateStr = formatDateShort(p.date)
  const cap     = p.capacity ? `\n👥 Terbatas ${p.capacity} orang` : ''
  const notes   = p.notes   ? `\n\n${p.notes}`                      : ''

  return `Ada kelas ekstra nih kak! 🎉

${p.className}
📅 ${dayName}, ${dateStr}
⏰ ${formatTime(p.startTime)} – ${formatTime(p.endTime)}
📍 ${p.location}${cap}${notes}

Sampai ketemu! 💪`
}
