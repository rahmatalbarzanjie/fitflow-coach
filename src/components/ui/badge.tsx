import { cn } from '@/lib/utils'

type Color = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'violet' | 'orange'

interface BadgeProps {
  children: React.ReactNode
  color?: Color
  className?: string
}

const colors: Record<Color, string> = {
  gray:   'bg-gray-100 text-gray-600',
  blue:   'bg-blue-50 text-blue-700',
  green:  'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  red:    'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
  orange: 'bg-orange-50 text-orange-700',
}

export function Badge({ children, color = 'gray', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        colors[color],
        className
      )}
    >
      {children}
    </span>
  )
}
