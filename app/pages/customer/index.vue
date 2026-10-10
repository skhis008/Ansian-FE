<script setup lang="ts">
import { computed } from 'vue'
import { isRideCancelled, normalizeRides } from '#shared/types'
import type { ChartPoint, RideResourceShape } from '#shared/types'
import { formatRupiah, formatRelative } from '#shared/utils/format'

definePageMeta({ layout: 'app' })

const auth = useAuthStore()
const rideStore = useRideStore()
const chat = useChatStore()

useSeoMeta({ title: 'Beranda', robots: 'noindex, nofollow' })

type PassengerSummary = {
  role: 'user'
  total_rides: number
  active_rides: number
  completed_rides: number
  cancelled_rides: number
  rides_today: number
  total_spent: number
  currency: string
  series: ChartPoint[]
}

const { data: summary } = await useAsyncData('customer-summary', () =>
  http.get<{ data: PassengerSummary }>('/me/summary').then(r => r.data),
)

/*
 * Riwayat diambil dari `GET /rides`, bukan dari endpoint `/me/activity` yang
 * pernah ada. `rides` sudah dibatasi backend ke perjalanan milik orang yang
 * masuk — penumpang melihat miliknya, driver melihat miliknya — jadi endpoint
 * kedua hanya mengulang aturan yang sama dengan bentuk berbeda.
 */
const { data: recent } = await useAsyncData('customer-recent', async () => {
  const r = await http.get<{ data?: RideResourceShape[] }>('/rides', { per_page: 5 })
  return normalizeRides(r)
})

const { data: active } = await useAsyncData('customer-active', async () => {
  const r = await http.get<{ data?: RideResourceShape[] }>('/rides', { scope: 'active', per_page: 1 })
  const ride = normalizeRides(r)[0] ?? null
  rideStore.setActive(ride)
  return ride
})

function copyPromo() {
  navigator.clipboard?.writeText('ANSIAN30')
  useToast().success('Kode promo disalin!')
}

const quickActions = [
  { label: 'Motor', desc: 'Mulai Rp4.000', icon: 'bike', to: '/customer/book', tone: 'bg-brand-50 text-brand-600' },
  { label: 'Kirim Barang', desc: 'Paket & dokumen', icon: 'package', to: '/customer/book', tone: 'bg-amber-50 text-amber-600' },
  { label: 'Riwayat', desc: 'Lihat perjalanan', icon: 'history', to: '/customer/rides', tone: 'bg-violet-50 text-violet-600' },
]

const stats = computed(() => [
  { label: 'Perjalanan', value: summary.value?.total_rides ?? 0, icon: 'navigation', tone: 'text-brand-600 bg-brand-50' },
  { label: 'Selesai', value: summary.value?.completed_rides ?? 0, icon: 'chart', tone: 'text-emerald-600 bg-emerald-50' },
  { label: 'Total transaksi', value: formatRupiah(summary.value?.total_spent ?? 0), icon: 'wallet', tone: 'text-violet-600 bg-violet-50' },
])
</script>

<template>
  <div class="space-y-6">
    <!-- Active ride banner -->
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100"
    >
      <NuxtLink
        v-if="active"
        to="/customer/active"
        class="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-4 text-white shadow-lift transition hover:from-brand-700 hover:to-brand-800"
      >
        <span class="relative grid size-11 shrink-0 place-items-center rounded-xl bg-white/15">
          <span class="absolute inset-0 animate-ping rounded-xl bg-white/20" />
          <UiIcon name="navigation" class="relative size-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold">Perjalanan sedang berjalan</p>
          <p class="truncate text-xs text-brand-100">
            {{ active.pickup.place_name }} → {{ active.destination.place_name }}
          </p>
        </div>
        <UiIcon name="chevron-right" class="size-5 shrink-0" />
      </NuxtLink>
    </Transition>

    <!-- Greeting -->
    <div>
      <h2 class="text-xl font-bold tracking-tight text-ink-900">
        Halo, {{ auth.displayName.split(' ')[0] }}! 👋
      </h2>
      <p class="mt-0.5 text-sm text-ink-500">Mau ke mana hari ini?</p>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <NuxtLink
        v-for="a in quickActions"
        :key="a.label"
        :to="a.to"
        class="group rounded-2xl border border-ink-200/80 bg-white p-4 transition hover:border-brand-300 hover:shadow-soft"
      >
        <span class="grid size-10 place-items-center rounded-xl transition group-hover:scale-105" :class="a.tone">
          <UiIcon :name="a.icon" class="size-5" />
        </span>
        <p class="mt-3 text-sm font-bold text-ink-900">{{ a.label }}</p>
        <p class="text-[11px] text-ink-500">{{ a.desc }}</p>
      </NuxtLink>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <UiCard v-for="s in stats" :key="s.label" class="flex items-center gap-3">
        <span class="grid size-10 shrink-0 place-items-center rounded-xl" :class="s.tone">
          <UiIcon :name="s.icon" class="size-5" />
        </span>
        <div class="min-w-0">
          <p class="text-[11px] font-medium text-ink-500">{{ s.label }}</p>
          <p class="truncate text-sm font-bold text-ink-900">{{ s.value }}</p>
        </div>
      </UiCard>
    </div>

    <div class="grid gap-5 lg:grid-cols-3">
      <!-- Aktivitas -->
      <div class="lg:col-span-2">
        <AppPageHeader title="Aktivitas Terakhir">
          <template #actions>
            <UiButton to="/customer/rides" variant="ghost" size="sm">
              Lihat semua
              <template #icon><UiIcon name="chevron-right" class="size-4" /></template>
            </UiButton>
          </template>
        </AppPageHeader>

        <div v-if="!recent?.length" class="rounded-2xl border border-ink-200 bg-white p-8 text-center">
          <p class="text-sm text-ink-500">Belum ada aktivitas. Yuk pesan pertama kamu!</p>
        </div>

        <div v-else class="space-y-2.5">
          <NuxtLink
            v-for="a in recent.slice(0, 5)"
            :key="a.id"
            :to="`/customer/rides/${a.id}`"
            class="flex items-center gap-3 rounded-2xl border border-ink-200/80 bg-white p-3.5 transition hover:border-brand-300 hover:shadow-soft"
          >
            <span
              class="grid size-9 shrink-0 place-items-center rounded-xl"
              :class="a.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : isRideCancelled(a.status) ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'"
            >
              <UiIcon name="navigation" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-ink-900">
                {{ a.pickup.address }} → {{ a.destination.address }}
              </p>
              <p class="text-[11px] text-ink-500">{{ formatRelative(a.created_at) }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-sm font-bold text-ink-900">{{ formatRupiah(a.fare) }}</p>
              <RideStatusBadge :status="a.status" size="sm" />
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Promo + CS -->
      <div class="space-y-4">
        <UiCard class="overflow-hidden !p-0">
          <div class="bg-gradient-to-br from-ink-900 to-brand-900 p-5 text-white">
            <UiIcon name="gift" class="size-6" />
            <p class="mt-3 text-lg font-bold">Diskon 30%</p>
            <p class="mt-1 text-sm text-white/70">Untuk 3 perjalanan berikutnya</p>
            <div class="mt-4 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
              <code class="flex-1 font-mono text-sm font-bold tracking-wider">ANSIAN30</code>
              <button type="button" class="text-white/70 transition hover:text-white" @click="copyPromo">
                <UiIcon name="copy" class="size-4" />
              </button>
            </div>
          </div>
        </UiCard>

        <UiCard>
          <h3 class="text-sm font-bold text-ink-900">Butuh bantuan?</h3>
          <p class="mt-1 text-xs text-ink-500">Tim kami siap 24/7</p>
          <UiButton to="/customer/chat" variant="outline" size="sm" block class="mt-4">
            <template #icon><UiIcon name="message-circle" class="size-4" /></template>
            Chat Customer Service
          </UiButton>
        </UiCard>

        <UiCard v-if="chat.totalUnread > 0">
          <div class="flex items-center gap-3">
            <span class="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-600">
              <UiIcon name="message-circle" class="size-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink-900">{{ chat.totalUnread }} pesan belum dibaca</p>
              <p class="text-[11px] text-ink-500">Lihat percakapan terbaru</p>
            </div>
            <UiButton to="/customer/chat" variant="ghost" size="sm" icon-only>
              <template #icon><UiIcon name="chevron-right" class="size-4" /></template>
            </UiButton>
          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>
