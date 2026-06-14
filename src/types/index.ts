export type MemberStatus = 'new' | 'active' | 'at_risk' | 'inactive'
export type PaymentMode = 'free' | 'drop_in' | 'prepaid' | 'debt'
export type PaymentMethod = 'cash' | 'transfer'
export type SessionStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
export type EventStatus = 'draft' | 'published' | 'completed' | 'cancelled'
export type RegistrationTier = 'early_bird' | 'ots'
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected'
export type ClassType = 'zumba' | 'yoga' | 'pilates' | 'poundfit' | 'aerobic' | 'barre' | 'other'

export type MemberSummary = {
  id: string
  user_id: string
  name: string
  phone: string
  status: MemberStatus
  last_attended_at: string | null
  created_at: string
  total_attended: number
  attended_this_month: number
  total_revenue: number
}

export type TodaySession = {
  session_id: string
  class_id: string
  session_date: string
  start_time: string
  end_time: string
  status: SessionStatus
  class_name: string
  class_type: ClassType
  location: string | null
  user_id: string
  capacity: number | null
  attended_count: number
  session_revenue: number
}

export type EventRegistrationSummary = {
  id: string
  event_id: string
  registrant_name: string
  registrant_phone: string
  tier: RegistrationTier
  amount_paid: number
  payment_status: PaymentStatus
  attended: boolean
  invited_to_join_at: string | null
  joined_as_member_at: string | null
  registered_at: string
  confirmed_at: string | null
  proof_url: string
  rejection_note: string | null
  event_title: string
  event_date: string
  is_member: boolean
  can_invite_to_join: boolean
}
