import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/setup', '/api/setup', '/admin-login', '/staff-login']
const STUDENT_PREFIXES = ['/dashboard', '/coursework', '/nutrition', '/training', '/matches', '/profile', '/gps']
const PARENT_PREFIXES = ['/parent']

async function getUserRole(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=role`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as { role: string }[]
    return rows[0]?.role ?? null
  } catch {
    return null
  }
}

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
  const isPublic = PUBLIC_PATHS.some(p => path.startsWith(p))

  // Unauthenticated on a protected page → /login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!user) return supabaseResponse

  // Decide if we need role-based routing for this path
  const needsRoleCheck =
    path.startsWith('/admin') ||
    STUDENT_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ||
    PARENT_PREFIXES.some(p => path === p || path.startsWith(p + '/')) ||
    (isPublic && !path.startsWith('/admin-login') && !path.startsWith('/staff-login'))

  if (!needsRoleCheck) return supabaseResponse

  const role = await getUserRole(
    user.id,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // If role lookup fails, allow through — layouts will do their own checks
  if (!role) return supabaseResponse

  const isStaff = role === 'admin' || role === 'coach' || role === 'teacher'
  const isParent = role === 'parent'

  // Authenticated user on auth page → role-appropriate home
  if (isPublic && !path.startsWith('/admin-login') && !path.startsWith('/staff-login')) {
    const home = isStaff ? '/admin/gps-dashboard' : isParent ? '/parent/dashboard' : '/dashboard'
    return NextResponse.redirect(new URL(home, request.url))
  }

  // Staff hitting student pages → admin area
  if (isStaff && STUDENT_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/admin/gps-dashboard', request.url))
  }

  // Students hitting admin pages → dashboard
  if (!isStaff && path.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Parents hitting student or admin pages → parent portal
  if (isParent && (STUDENT_PREFIXES.some(p => path === p || path.startsWith(p + '/')) || path.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/parent/dashboard', request.url))
  }

  // Non-parents hitting parent pages → appropriate home
  if (!isParent && PARENT_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    const home = isStaff ? '/admin/gps-dashboard' : '/dashboard'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
