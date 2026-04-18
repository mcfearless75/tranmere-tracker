import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
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

  const publicPaths = ['/login', '/signup', '/setup', '/api/setup', '/admin-login', '/staff-login']
  const isPublic = publicPaths.some(p => path.startsWith(p))

  // Unauthenticated → login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated users only — use service client to reliably read role (bypasses RLS)
  let role: string | null = null
  if (user) {
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
    const { data: profile } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    role = profile?.role ?? null
  }

  const isStaff = role === 'admin' || role === 'coach' || role === 'teacher'

  // Authenticated on a public/auth page → bounce to role-appropriate home
  if (user && isPublic && !path.startsWith('/admin-login') && !path.startsWith('/staff-login')) {
    return NextResponse.redirect(new URL(isStaff ? '/admin/gps-dashboard' : '/dashboard', request.url))
  }

  // Staff should never see student pages
  const studentOnlyPrefixes = ['/dashboard', '/coursework', '/nutrition', '/training', '/matches', '/profile', '/gps']
  if (user && isStaff && studentOnlyPrefixes.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/admin/gps-dashboard', request.url))
  }

  // Students should never see admin pages
  if (user && !isStaff && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
