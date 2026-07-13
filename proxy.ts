import { withAuth } from 'next-auth/middleware'

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const path = req.nextUrl.pathname
      const isPublic =
        path === '/' ||
        path === '/login' ||
        path === '/how-it-works' ||
        path === '/sleep-guide' ||
        path === '/privacy' ||
        path === '/docs/mcp' ||
        path.startsWith('/api/auth') ||
        path.startsWith('/api/oauth') ||
        path.startsWith('/.well-known/') ||
        path === '/mcp'

      return isPublic || !!token
    },
  },
  pages: {
    signIn: '/login',
  },
})

// Run auth on application routes; the callback above owns the public allowlist.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)',
  ],
}
