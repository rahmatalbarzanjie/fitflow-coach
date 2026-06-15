'use client'

export function DashboardGreeting({ name }: { name: string }) {
  const hour = new Date().getHours()

  let salam = 'Selamat pagi'
  let motivasi = 'Semangat mengajar hari ini! 💪'

  if (hour >= 11 && hour < 15) {
    salam    = 'Selamat siang'
    motivasi = 'Sudah makan siang? Jangan lupa istirahat 😊'
  } else if (hour >= 15 && hour < 18) {
    salam    = 'Selamat sore'
    motivasi = 'Tetap semangat sampai selesai! 💪'
  } else if (hour >= 18) {
    salam    = 'Selamat malam'
    motivasi = 'Hari yang produktif! Selamat beristirahat 🌙'
  }

  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-gray-900">{salam}, {name}! ✨</h1>
      <p className="text-sm text-gray-500 mt-0.5">{motivasi}</p>
    </div>
  )
}
