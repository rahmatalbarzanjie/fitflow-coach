export default function BerandaLoading() {
  return (
    <div className="w-full max-w-2xl mx-auto animate-pulse">

      {/* Salam skeleton */}
      <div className="mb-5">
        <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-32 bg-gray-100 rounded-lg mt-2" />
      </div>

      {/* Hari Ini skeleton */}
      <div className="mb-4">
        <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 h-16" />
      </div>

      {/* Aksi Cepat skeleton */}
      <div className="mb-4">
        <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>

      {/* Perlu Perhatian skeleton */}
      <div className="mb-4">
        <div className="h-3 w-28 bg-gray-200 rounded mb-2" />
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-4 h-14" />
      </div>

      {/* Bulan Ini skeleton */}
      <div>
        <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20" />
          ))}
        </div>
      </div>

    </div>
  )
}