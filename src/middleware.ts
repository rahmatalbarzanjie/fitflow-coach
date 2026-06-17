import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const adminEmail = process.env.ADMIN_EMAIL
  const isAdminUser = user?.email === adminEmail

  // Routes accessible without login
  const isPublicRoute =
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/home') ||
    path.startsWith('/daftar') ||
    path.startsWith('/api/') ||
    path.match(/^\/[^/]+$/) !== null ||        // instructor landing pages /{slug}
    path.match(/^\/[^/]+\/daftar/) !== null    // event registration /{slug}/daftar/...

  // Unauthenticated → login
  if (!isPublicRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → away from auth pages
  if ((path === '/login' || path === '/register') && user) {
    return NextResponse.redirect(new URL(isAdminUser ? '/admin' : '/', request.url))
  }

  // Root for non-logged-in users → marketing page
  if (path === '/' && !user) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Admin: redirect from / (instructor dashboard) to /admin
  if (path === '/' && isAdminUser) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // Admin: /settings is instructor-scoped (profil, nomor bot, halaman publik per
  // instruktur) — tidak relevan untuk akun developer, arahkan ke Konfigurasi platform
  if (path.startsWith('/settings') && isAdminUser) {
    return NextResponse.redirect(new URL('/admin/config', request.url))
  }

  // Trial expiry check for authenticated non-admin dashboard users
  const isDashboardRoute =
    !isPublicRoute &&
    !path.startsWith('/expired') &&
    !path.startsWith('/settings') &&
    !path.startsWith('/api') &&
    !path.startsWith('/admin') &&
    path !== '/'

  if (user && !isAdminUser && (isDashboardRoute || path === '/') && path !== '/expired') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('trial_expires_at')
      .eq('id', user.id)
      .single()

    // Expiry berlaku untuk status apapun (trial atau active) — pembayaran
    // punya durasi nyata sekarang, jadi "active" tidak lagi berarti lifetime.
    const expiresAt = (profile as any)?.trial_expires_at
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.redirect(new URL('/expired', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
