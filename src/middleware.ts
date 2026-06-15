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

  // Routes accessible without login
  const isPublicRoute =
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/home') ||
    path.startsWith('/daftar') ||
    path.startsWith('/api/') ||
    path.match(/^\/[^/]+$/) !== null ||          // instructor landing pages /{slug}
    path.match(/^\/[^/]+\/daftar/) !== null       // event registration /{slug}/daftar/...

  // Unauthenticated → login
  if (!isPublicRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Already logged in → away from auth pages
  if ((path === '/login' || path === '/register') && user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Root for non-logged-in users → marketing page
  if (path === '/' && !user) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  // Trial expiry check for authenticated dashboard users
  const adminEmail = process.env.ADMIN_EMAIL
  const isAdminUser = user?.email === adminEmail
  const isDashboardRoute =
    !isPublicRoute &&
    !path.startsWith('/expired') &&
    !path.startsWith('/settings') &&
    !path.startsWith('/api') &&
    !path.startsWith('/admin') &&
    path !== '/'  // root is the dashboard, check it too

  if (user && !isAdminUser && (isDashboardRoute || path === '/') && path !== '/expired') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, trial_expires_at')
      .eq('id', user.id)
      .single()

    if (profile) {
      const isActive  = (profile as any).subscription_status === 'active'
      const expiresAt = (profile as any).trial_expires_at

      if (!isActive && expiresAt && new Date(expiresAt) < new Date()) {
        return NextResponse.redirect(new URL('/expired', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
