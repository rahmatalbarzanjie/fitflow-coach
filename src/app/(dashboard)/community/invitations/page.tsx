import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { InvitationsList } from '@/components/community/InvitationsList'

export default async function CommunityInvitationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [candidatesRes, benefitsRes] = await Promise.all([
    (supabase.from('community_invitation_candidates') as any)
      .select('id, name, phone, class_type, status, attendance_date, invited_at')
      .eq('user_id', user!.id)
      .in('status', ['pending', 'invited'])
      .order('attendance_date', { ascending: false })
      .limit(50),

    (supabase.from('class_type_benefits') as any)
      .select('type, wa_invite_link')
      .eq('user_id', user!.id),
  ])

  const candidates = (candidatesRes.data ?? []) as any[]
  const benefits   = (benefitsRes.data ?? []) as any[]

  // Map class_type → apakah link sudah ada
  const linkAvailableMap = Object.fromEntries(
    benefits.map((b: any) => [b.type, !!(b.wa_invite_link?.trim())])
  )

  const pendingCount  = candidates.filter(c => c.status === 'pending').length
  const invitedCount  = candidates.filter(c => c.status === 'invited').length

  return (
    <div className="w-full max-w-2xl mx-auto">
      <PageHeader
        backHref="/community"
        title="Undangan Komunitas"
        subtitle={`${pendingCount} menunggu · ${invitedCount} sudah diundang`}
      />
      <InvitationsList
        candidates={candidates}
        linkAvailableMap={linkAvailableMap}
      />
    </div>
  )
}
