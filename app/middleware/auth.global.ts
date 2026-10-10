import type { UserRole } from '#shared/types'

export default defineNuxtRouteMiddleware(async to => {
  const auth = useAuthStore()

  /* Public routes */
  const publicPaths = ['/login', '/register', '/verifikasi', '/faq', '/tentang', '/kebijakan-privasi', '/terms', '/driver/daftar']
  const isPublic = publicPaths.includes(to.path) || to.path === '/'

  if (!auth.initialized) {
    await auth.fetchUser()
  }

  /* Sudah login & buka halaman auth → lempar ke home sesuai role */
  if (auth.isAuthenticated && (to.path === '/login' || to.path === '/register' || to.path === '/verifikasi')) {
    return navigateTo(auth.homePath)
  }

  if (isPublic) return

  /* Butuh login */
  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} })
  }

  /*
   * Gate per peran.
   *
   * Pemetaannya lewat objek, bukan `segment !== auth.role`. Segmen URL dan
   * nilai peran tidak lagi sama nama: `/customer` dijaga oleh peran `user`,
   * jadi perbandingan langsung akan menolak setiap penumpang
   * dari halamannya sendiri.
   */
  const segment = to.path.split('/')[1]
  const required = ROLE_SEGMENT[segment]

  if (required && required !== auth.role) {
    return navigateTo(auth.homePath)
  }
})

/**
 * Segmen URL -> peran yang boleh membukanya.
 *
 * `/customer` adalah alias dari peran `user`. Keduanya diterima supaya URL lama
 * tetap hidup dan `/user` bisa dipakai tanpa redirect yang sudah tidak perlu.
 */
const ROLE_SEGMENT: Record<string, UserRole | undefined> = {
  customer: 'user',
  user: 'user',
  driver: 'driver',
  admin: 'admin',
}
