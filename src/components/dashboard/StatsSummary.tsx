'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Calendar, Users, TrendingUp, Banknote } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Period = 'week' | 'month' | 'year'

interface Stats {
  totalSessions: number
  totalAttendance: number
  totalRevenue: number
  newMembers: number
}

const TABS: { value: Period; label: string }[] = [
  { value: 'week',  label: 'Minggu Ini' },
  { value: 'month', label: 'Bulan Ini'  },
  { value: 'year',  label: 'Tahun Ini'  },
]

function getPeriodStart(period: Period): string {
  const now = new Date()
  if (period === 'week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff)).toISOString().split('T')[0]
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  }
  return new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
}

export function StatsSummary({ userId }: { userId: string }) {
  const [period, setPeriod] = useState<Period>('month')
  const [stats,  setStats]  = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const loadStats = useCallback(async (p: Period) => {
    setLoading(true)
    const from = getPeriodStart(p)
    const to   = new Date().toISOString().split('T')[0]

    const [sessRes, attRes, memberRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('id')
        .eq('user_id', userId)
        .gte('session_date', from)
        .lte('session_date', to),

      supabase
        .from('attendance')
        .select('amount_paid, sessions!inner(session_date, user_id)')
        .eq('sessions.user_id', userId)
        .gte('sessions.session_date', from)
        .lte('sessions.session_date', to),

      supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', from + 'T00:00:00'),
    ])

    const revenue = (attRes.data ?? []).reduce((s: number, a: any) => s + Number(a.amount_paid ?? 0), 0)

    setStats({
      totalSessions:  sessRes.data?.length ?? 0,
      totalAttendance: attRes.data?.length ?? 0,
      totalRevenue:   revenue,
      newMembers:     memberRes.data?.length ?? 0,
    })
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { loadStats(period) }, [period, loadStats])

  const cards = stats ? [
    { label: 'Total Sesi',        value: stats.totalSessions,   unit: 'sesi',     icon: Calendar,    color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { label: 'Total Kehadiran',   value: stats.totalAttendance, unit: 'kehadiran', icon: Users,       color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Total Pemasukan',   value: formatRupiah(stats.totalRevenue), unit: '', icon: Banknote,  color: 'text-green-600',  bg: 'bg-green-50'  },
    { label: 'Member Baru',       value: stats.newMembers,      unit: 'member',   icon: TrendingUp,  color: 'text-orange-600', bg: 'bg-orange-50' },
  ] : []

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-gray-900">Ringkasan Statistik</h2>
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
          {TABS.map(t => (
            <button
              key={t.value}
              onClick={() => setPeriod(t.value)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-medium transition-all',
                period === t.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, value, unit, icon: Icon, color, bg }) => (
            <div key={label} className="p-4 bg-gray-50 rounded-xl">
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-lg font-bold text-gray-900">{value}</p>
              {unit && <p className="text-xs text-gray-400 mt-0.5">{unit}</p>}
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
