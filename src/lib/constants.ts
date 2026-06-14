export const MEMBER_STATUS = {
  new:      { label: 'Baru',        color: 'blue'   },
  active:   { label: 'Aktif',       color: 'green'  },
  at_risk:  { label: 'At Risk',     color: 'yellow' },
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

export const REGISTRATION_TIER = {
  early_bird: { label: 'Early Bird' },
  ots:        { label: 'OTS'        },
} as const

export const PAYMENT_STATUS = {
  pending:   { label: 'Menunggu Konfirmasi', color: 'yellow' },
  confirmed: { label: 'Terkonfirmasi',       color: 'green'  },
  rejected:  { label: 'Ditolak',             color: 'red'    },
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
