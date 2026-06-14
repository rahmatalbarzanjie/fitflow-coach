import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'EEEE, d MMMM yyyy', { locale: id })
}

export function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'd MMM yyyy', { locale: id })
}

export function formatTime(time: string): string {
  return time.substring(0, 5)
}

export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: id })
}

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek]
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 1) + '...' : str
}
