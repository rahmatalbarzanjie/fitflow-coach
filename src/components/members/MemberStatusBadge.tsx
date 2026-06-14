import { Badge } from '@/components/ui/badge'
import { MEMBER_STATUS } from '@/lib/constants'

type Color = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'violet' | 'orange'

export function MemberStatusBadge({ status }: { status: string | null }) {
  const config = MEMBER_STATUS[status as keyof typeof MEMBER_STATUS]
  if (!config) return null
  return <Badge color={config.color as Color}>{config.label}</Badge>
}
