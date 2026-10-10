<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RideStatus } from '#shared/types'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Riwayat Perjalanan', robots: 'noindex, nofollow' })

const driver = useDriverStore()
const toast = useToast()
const search = ref('')
const statusFilter = ref<RideStatus | 'all'>('all')

onMounted(async () => {
  try {
    await driver.fetchRides()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal memuat riwayat perjalanan.')
  }
})

const TABS: { value: RideStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'in_progress', label: 'Berjalan' },
  { value: 'completed', label: 'Selesai' },
  { value: 'passenger_cancelled', label: 'Dibatalkan penumpang' },
  { value: 'driver_cancelled', label: 'Dibatalkan driver' },
  { value: 'no_driver_found', label: 'Tidak ada driver' },
]

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  return driver.rides.filter(r => {
    if (statusFilter.value !== 'all' && r.status !== statusFilter.value) return false
    if (!q) return true
    return (
      r.ride_code.toLowerCase().includes(q) ||
      r.pickup.address.toLowerCase().includes(q) ||
      r.destination.address.toLowerCase().includes(q)
    )
  })
})
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Riwayat Perjalanan" description="Semua perjalanan yang pernah kamu layani.">
      <template #actions>
        <UiBadge tone="gray">{{ driver.rides.length }} perjalanan</UiBadge>
      </template>
    </AppPageHeader>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div class="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1">
        <button
          v-for="t in TABS"
          :key="t.value"
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition"
          :class="statusFilter === t.value ? 'bg-white text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800'"
          @click="statusFilter = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="relative sm:ml-auto sm:w-64">
        <UiIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
        <input
          v-model="search"
          type="search"
          placeholder="Cari kode atau alamat…"
          class="h-10 w-full rounded-xl border border-ink-200 bg-white pr-3 pl-9 text-sm outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
        >
      </div>
    </div>

    <div v-if="driver.loadingRides" class="space-y-3">
      <UiCard v-for="i in 4" :key="i"><UiSkeletonBlock :lines="3" /></UiCard>
    </div>

    <UiCard v-else-if="!filtered.length" :padded="false">
      <AppEmptyState
        icon="history"
        title="Tidak ada perjalanan"
        description="Perjalanan yang kamu terima akan muncul di sini."
      >
        <UiButton to="/driver/requests">Lihat Permintaan</UiButton>
      </AppEmptyState>
    </UiCard>

    <div v-else class="space-y-3">
      <UiCard v-for="r in filtered" :key="r.id">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="font-mono text-xs font-bold text-ink-700">{{ r.ride_code }}</p>
              <RideStatusBadge :status="r.status" />
            </div>

            <div class="mt-2.5 space-y-1.5">
              <p class="flex items-start gap-2 text-[13px] text-ink-700">
                <span class="mt-1.5 size-2 shrink-0 rounded-full border-2 border-ink-400" />
                <span class="truncate">{{ r.pickup.place_name || r.pickup.address }}</span>
              </p>
              <p class="flex items-start gap-2 text-[13px] text-ink-700">
                <UiIcon name="map-pin" class="mt-0.5 size-3 shrink-0 text-rose-600" />
                <span class="truncate">{{ r.destination.place_name || r.destination.address }}</span>
              </p>
            </div>

            <p class="mt-2.5 text-[11px] text-ink-400">
              {{ r.customer?.name }} · {{ r.distance_km.toFixed(1) }} km · {{ r.duration_min }} mnt
            </p>
          </div>

          <div class="text-right">
            <p class="text-base font-bold text-emerald-600">+{{ Math.round(r.fare * 0.8).toLocaleString('id-ID') }}</p>
            <p class="text-[10px] text-ink-400">80% dari tarif</p>
          </div>
        </div>
      </UiCard>
    </div>
  </div>
</template>
