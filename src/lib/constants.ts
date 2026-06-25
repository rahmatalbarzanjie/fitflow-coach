export const MEMBER_STATUS = {
  new:      { label: 'Baru',        color: 'blue'   },
  active:   { label: 'Aktif',       color: 'green'  },
  at_risk:  { label: 'Perlu Follow Up', color: 'orange' },
  inactive: { label: 'Tidak Aktif', color: 'red'    },
} as const

export const PAYMENT_MODE = {
  free:    { label: 'Gratis'      },
  drop_in: { label: 'Drop-in'     },
  prepaid: { label: 'Sudah Lunas' },
  debt:    { label: 'Belum Bayar' },
} as const

export const CLASS_TYPES = [
  { value: 'zumba',    label: 'Zumba'    },
  { value: 'yoga',     label: 'Yoga'     },
  { value: 'pilates',  label: 'Pilates'  },
  { value: 'poundfit', label: 'Poundfit' },
  { value: 'aerobic',  label: 'Aerobic'  },
  { value: 'barre',    label: 'Barre'    },
  { value: 'other',    label: 'Lainnya'  },
] as const

// Label "Reguler" (bukan "OTS") supaya tidak rancu dengan PAYMENT_METHOD.cash
// di bawah - keduanya sama-sama berasal dari kolom enum bernilai 'ots', tapi
// makna istilahnya beda total: di sini soal tier HARGA (reguler vs early
// bird), di PAYMENT_METHOD soal METODE bayar (tunai di tempat vs transfer).
export const REGISTRATION_TIER = {
  early_bird: { label: 'Early Bird' },
  ots:        { label: 'Reguler'    },
} as const

export const PAYMENT_METHOD = {
  cash:     { label: 'OTS'      },
  transfer: { label: 'Transfer' },
} as const

export const PAYMENT_STATUS = {
  pending:   { label: 'Menunggu Konfirmasi', color: 'yellow' },
  confirmed: { label: 'Terkonfirmasi',       color: 'green'  },
  rejected:  { label: 'Ditolak',             color: 'red'    },
  cancelled: { label: 'Dibatalkan',          color: 'gray'   },
} as const

export const EVENT_STATUS = {
  draft:     { label: 'Draft'      },
  published: { label: 'Aktif'      },
  completed: { label: 'Selesai'    },
  cancelled: { label: 'Dibatalkan' },
} as const

export const MEMBER_STATUS_THRESHOLDS = {
  new:     7,
  active:  14,
  at_risk: 30,
} as const
