import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-01-15',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: false },
  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    build: {
      cssCodeSplit: true,
      target: 'es2022',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/leaflet')) return 'leaflet'
            if (id.includes('node_modules/pusher-js') || id.includes('node_modules/laravel-echo')) return 'realtime'
          },
        },
      },
    },
  },

  runtimeConfig: {
    // Sengaja TIDAK di `public`. URL backend adalah rahasia deployment: kalau
    // masuk ke `public`, ia terkirim ke browser di setiap respons dan bisa dibaca
    // siapa pun yang membuka devtools. Browser tidak pernah memanggil Laravel
    // secara langsung — semua lewat proxy server-side, jadi tidak butuh CORS
    // dan URL ini pun tidak perlu diketahui klien.
    apiBase: process.env.NUXT_API_BASE || 'http://127.0.0.1:8000',
    public: {
      // true = pakai mock API bawaan (server/utils/mockApi). false = panggil Laravel.
      useMock: process.env.NUXT_PUBLIC_USE_MOCK !== 'false',
      appName: 'Ansian',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      currency: 'IDR',
      // Realtime (Laravel Reverb / Soketi)
      realtime: {
        enabled: process.env.NUXT_PUBLIC_REALTIME_ENABLED === 'true',
        key: process.env.NUXT_PUBLIC_REALTIME_KEY || '',
        wsHost: process.env.NUXT_PUBLIC_REALTIME_HOST || 'localhost',
        wsPort: process.env.NUXT_PUBLIC_REALTIME_PORT || '8080',
        wssPort: process.env.NUXT_PUBLIC_REALTIME_WSS_PORT || '8081',
        forceTLS: process.env.NUXT_PUBLIC_REALTIME_TLS === 'true',
        cluster: process.env.NUXT_PUBLIC_REALTIME_CLUSTER || 'mt1',
      },
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/login': { prerender: true },
    '/register': { prerender: true },
    '/faq': { prerender: true },
    '/tentang': { prerender: true },
    '/kebijakan-privasi': { prerender: true },
    '/terms': { prerender: true },
    '/sitemap.xml': { prerender: true },
    '/robots.txt': { prerender: true },
    // Halaman app: SSR supaya cepat & terindeks sesuai session
    '/customer/**': { ssr: true },
    '/driver/**': { ssr: true },
    '/admin/**': { ssr: true },
    // Alias peran: nilai enum di backend adalah `user` (ADR-011), tapi URLnya
    // tetap `/customer` supaya tautan lama tidak mati. `/user/*` diarahkan ke
    // padanannya supaya keduanya benar-benar bisa dipakai.
    '/user': { redirect: '/customer' },
    '/user/**': { redirect: '/customer/**' },
  },

  nitro: {
    compressPublicAssets: true,
    storage: { data: { driver: 'memory' } },
  },

  experimental: {
    payloadExtraction: true,
    viewTransition: false,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f172a' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://unpkg.com' },
        { rel: 'preconnect', href: 'https://tile.openstreetmap.org' },
        { rel: 'dns-prefetch', href: 'https://fonts.gstatic.com' },
      ],
    },
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
