import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ContentPage } from './ContentPage'

export const metadata = { title: 'Buat Konten - FuelOS' }

export default async function ContentRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch last 10 generate_content requests for history tab
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: history } = await (supabase.from('ai_requests') as any)
    .select('id, created_at, prompt, response')
    .eq('user_id', user.id)
    .eq('type', 'generate_content')
    .order('created_at', { ascending: false })
    .limit(10)

  return <ContentPage initialHistory={history ?? []} />
}
