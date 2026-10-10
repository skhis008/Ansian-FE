<script setup lang="ts">
import { computed } from 'vue'

const auth = useAuthStore()
const ui = useUiStore()
const route = useRoute()
const chat = useChatStore()
const notification = useNotificationStore()

interface NavItem {
  label: string
  to: string
  icon: string
  badge?: () => number
}

const nav = computed<NavItem[]>(() => {
  const base = auth.homePath
  if (auth.isUser) {
    return [
      { label: 'Beranda', to: base, icon: 'home' },
      { label: 'Pesan Antar', to: '/customer/book', icon: 'navigation' },
      { label: 'Riwayat', to: '/customer/rides', icon: 'history' },
      { label: 'Pesanan Aktif', to: '/customer/active', icon: 'clock', badge: () => (useRideStore().hasActiveRide ? 1 : 0) },
      { label: 'Chat', to: '/customer/chat', icon: 'message-circle', badge: () => chat.totalUnread },
      { label: 'Pembayaran', to: '/customer/payments', icon: 'credit-card' },
      { label: 'Profil', to: '/customer/profile', icon: 'user' },
    ]
  }
  if (auth.isDriver) {
    return [
      { label: 'Dashboard', to: base, icon: 'home' },
      { label: 'Permintaan', to: '/driver/requests', icon: 'inbox', badge: () => useDriverStore().jobs.length },
      { label: 'Perjalanan Aktif', to: '/driver/active', icon: 'navigation' },
      { label: 'Riwayat', to: '/driver/rides', icon: 'history' },
      { label: 'Pendapatan', to: '/driver/earnings', icon: 'wallet' },
      { label: 'Chat', to: '/driver/chat', icon: 'message-circle', badge: () => chat.totalUnread },
      { label: 'Profil Kendaraan', to: '/driver/profile', icon: 'car' },
    ]
  }
  return [
    { label: 'Dashboard', to: base, icon: 'chart' },
    { label: 'Perjalanan', to: '/admin/rides', icon: 'navigation' },
    { label: 'Pengguna', to: '/admin/users', icon: 'users' },
    { label: 'Driver', to: '/admin/drivers', icon: 'car' },
    { label: 'Transaksi', to: '/admin/transactions', icon: 'credit-card' },
    { label: 'Laporan', to: '/admin/reports', icon: 'file-text' },
    { label: 'Pengaturan', to: '/admin/settings', icon: 'settings' },
  ]
})

const pageTitle = computed(() => {
  const item = nav.value.find(n => route.path === n.to || (n.to !== auth.homePath && route.path.startsWith(n.to)))
  return item?.label ?? (auth.isAdmin ? 'Dashboard' : 'Beranda')
})

onMounted(async () => {
  await Promise.all([chat.fetchConversations(), notification.fetch()])
})

async function signOut() {
  await auth.logout()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex min-h-dvh bg-ink-50">
    <!-- ============ SIDEBAR (desktop) ============ -->
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex"
    >
      <div class="flex h-16 items-center gap-2.5 border-b border-ink-100 px-5">
        <UiBrandMark class="size-8" />
        <span class="text-[15px] font-bold tracking-tight text-ink-900">
          {{ $config.public.appName }}
        </span>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Navigasi utama">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
          :class="route.path === item.to
            ? 'bg-brand-50 text-brand-700'
            : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'"
        >
          <UiIcon :name="item.icon" class="size-[18px]" />
          <span class="flex-1">{{ item.label }}</span>
          <span
            v-if="item.badge && item.badge() > 0"
            class="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white"
          >
            {{ item.badge() }}
          </span>
        </NuxtLink>
      </nav>

      <div class="border-t border-ink-100 p-3">
        <div class="flex items-center gap-3 rounded-xl p-2">
          <UiAvatar :name="auth.displayName" :src="auth.user?.avatar_url" :size="36" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-ink-900">{{ auth.displayName }}</p>
            <p class="truncate text-[11px] font-medium text-ink-500 capitalize">{{ auth.role }}</p>
          </div>
        </div>
        <UiButton
          variant="ghost"
          size="sm"
          block
          class="mt-1.5 justify-start"
          @click="signOut"
        >
          <template #icon><UiIcon name="logout" class="size-4" /></template>
          Keluar
        </UiButton>
      </div>
    </aside>

    <!-- ============ MAIN ============ -->
    <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
      <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur-md sm:px-6">
        <button
          type="button"
          class="rounded-lg p-2 text-ink-600 transition hover:bg-ink-100 lg:hidden"
          aria-label="Buka menu"
          @click="ui.toggleSidebar(true)"
        >
          <UiIcon name="menu" class="size-5" />
        </button>

        <h1 class="truncate text-base font-semibold text-ink-900">{{ pageTitle }}</h1>

        <div class="ml-auto flex items-center gap-1.5">
          <UiRealtimeBadge />
          <UiNotificationBell />
          <NuxtLink
            to="/"
            class="hidden rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 sm:block"
            title="Beranda"
          >
            <UiIcon name="home" class="size-5" />
          </NuxtLink>
        </div>
      </header>

      <main class="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:pb-8">
        <slot />
      </main>
    </div>

    <!-- ============ SIDEBAR (mobile) ============ -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <aside
        v-if="ui.sidebarOpen"
        class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white shadow-lift lg:hidden"
      >
        <div class="flex h-16 items-center justify-between border-b border-ink-100 px-5">
          <div class="flex items-center gap-2.5">
            <UiBrandMark class="size-8" />
            <span class="text-[15px] font-bold text-ink-900">{{ $config.public.appName }}</span>
          </div>
          <button type="button" class="rounded-lg p-2 text-ink-500 hover:bg-ink-100" @click="ui.toggleSidebar(false)">
            <UiIcon name="x" class="size-5" />
          </button>
        </div>
        <nav class="flex-1 space-y-1 overflow-y-auto p-3">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition"
            :class="route.path === item.to ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'"
            @click="ui.toggleSidebar(false)"
          >
            <UiIcon :name="item.icon" class="size-[18px]" />
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="item.badge && item.badge() > 0"
              class="grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white"
            >
              {{ item.badge() }}
            </span>
          </NuxtLink>
        </nav>
        <div class="border-t border-ink-100 p-3">
          <UiButton
            variant="ghost"
            size="sm"
            block
            class="justify-start"
            @click="signOut"
          >
            <template #icon><UiIcon name="logout" class="size-4" /></template>
            Keluar
          </UiButton>
        </div>
      </aside>
    </Transition>

    <!-- ============ BOTTOM NAV (mobile) ============ -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 flex border-t border-ink-200 bg-white/95 backdrop-blur-md lg:hidden"
      style="padding-bottom: env(safe-area-inset-bottom)"
      aria-label="Navigasi cepat"
    >
      <NuxtLink
        v-for="item in nav.slice(0, 5)"
        :key="item.to"
        :to="item.to"
        class="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition"
        :class="route.path === item.to ? 'text-brand-600' : 'text-ink-400'"
      >
        <UiIcon :name="item.icon" class="size-5" />
        <span class="max-w-full truncate px-1">{{ item.label }}</span>
        <span
          v-if="item.badge && item.badge() > 0"
          class="absolute top-1.5 right-1/2 grid size-4 translate-x-3.5 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white"
        >
          {{ item.badge() }}
        </span>
      </NuxtLink>
    </nav>
  </div>
</template>
