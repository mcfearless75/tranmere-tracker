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

  const publicPaths = ['/login', '/signup']
  const isPublic = publicPaths.some(p => path.startsWith(p))

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users away from auth pages
  if (user && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Guard admin routes — only reachable if user is authenticated (checked above)
  if (user && path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'coach', 'teacher'].includes(profile.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
}
