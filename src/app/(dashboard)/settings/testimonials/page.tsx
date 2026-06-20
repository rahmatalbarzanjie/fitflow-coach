import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { TestimonialsManager } from '@/components/settings/TestimonialsManager'

export default async function SettingsTestimonialsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('id, name, content, photo_url, is_published, rating, created_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="w-full max-w-lg mx-auto">
      <PageHeader backHref="/settings" title="Testimoni" subtitle="Tampil di halaman publikmu" />
      <TestimonialsManager initialTestimonials={(testimonials ?? []) as any} />
    </div>
  )
}
