<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isRideCancelled, normalizeRides, type Paginated, type Ride, type RideResourceShape } from '#shared/types'
import { formatRupiah } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Riwayat Perjalanan', robots: 'noindex, nofollow' })

const auth = useAuthStore()
const toast = useToast()

const TABS = [
  { key: '', label: 'Semua' },
  { key: 'active', label: 'Aktif' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
] as const

const activeTab = ref<string>('')
const page = ref(1)
const search = ref('')
const debouncedSearch = ref('')

let timer: ReturnType<typeof setTimeout> | null = null
watch(search, v => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    debouncedSearch.value = v
    page.value = 1
  }, 350)
})

const { data, pending } = await useAsyncData(
  () => `customer-rides-${auth.user?.id}`,
  () =>
    http.get<{ data?: RideResourceShape[] }>('/rides', {
      filter: activeTab.value || undefined,
      q: debouncedSearch.value || undefined,
      page: page.value,
      per_page: 8,
    }),
  { watch: [activeTab, page, debouncedSearch] },
)

const rides = computed(() => normalizeRides(data.value))
const meta = computed(() => (data.value as unknown as Paginated<Ride> | null)?.meta ?? null)

const summary = computed(() => {
  const list = rides.value
  return {
    total: meta.value?.total ?? 0,
    spent: list.filter(r => r.status === 'completed').reduce((a, r) => a + r.fare, 0),
    completed: list.filter(r => r.status === 'completed').length,
    cancelled: list.filter(r => isRideCancelled(r.status)).length,
  }
})

function goPage(p: number) {
  page.value = p
  window?.scrollTo({ top: 0, behavior: 'smooth' })
}

async function exportCsv() {
  toast.info('Fitur ekspor akan tersedia setelah backend aktif.')
}
</script>

<template>
  <div>
    <AppPageHeader title="Riwayat Perjalanan" description="Semua perjalanan yang pernah kamu lakukan.">
      <template #actions>
        <UiButton variant="outline" size="sm" @click="exportCsv">
          <template #icon><UiIcon name="download" class="size-4" /></template>
          Ekspor
        </UiButton>
        <UiButton to="/customer/book" size="sm">
          <template #icon><UiIcon name="plus" class="size-4" /></template>
          Pesan Baru
        </UiButton>
      </template>
    </AppPageHeader>

    <!-- Ringkasan -->
    <div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <UiCard class="flex items-center gap-3 !p-4">
        <span class="grid size-9 place-items-center rounded-xl bg-ink-100 text-ink-600">
          <UiIcon name="history" class="size-4" />
        </span>
        <div>
          <p class="text-[11px] text-ink-500">Total</p>
          <p class="text-base font-bold text-ink-900">{{ summary.total }}</p>
        </div>
      </UiCard>
      <UiCard class="flex items-center gap-3 !p-4">
        <span class="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
          <UiIcon name="check-circle" class="size-4" />
        </span>
        <div>
          <p class="text-[11px] text-ink-500">Selesai</p>
          <p class="text-base font-bold text-ink-900">{{ summary.completed }}</p>
        </div>
      </UiCard>
      <UiCard class="flex items-center gap-3 !p-4">
        <span class="grid size-9 place-items-center rounded-xl bg-red-50 text-red-600">
          <UiIcon name="x" class="size-4" />
        </span>
        <div>
          <p class="text-[11px] text-ink-500">Dibatalkan</p>
          <p class="text-base font-bold text-ink-900">{{ summary.cancelled }}</p>
        </div>
      </UiCard>
      <UiCard class="flex items-center gap-3 !p-4">
        <span class="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <UiIcon name="wallet" class="size-4" />
        </span>
        <div>
          <p class="text-[11px] text-ink-500">Total Bayar</p>
          <p class="text-base font-bold text-ink-900">{{ formatRupiah(summary.spent) }}</p>
        </div>
      </UiCard>
    </div>

    <!-- Filter -->
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="shrink-0 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition"
          :class="activeTab === t.key ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-100'"
          @click="activeTab = t.key; page = 1"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="relative sm:w-64">
        <UiIcon name="search" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400" />
        <input
          v-model="search"
          type="search"
          placeholder="Cari kode atau lokasi…"
          class="h-10 w-full rounded-xl border border-ink-200 bg-white pr-3 pl-9 text-sm outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15"
        >
      </div>
    </div>

    <!-- List -->
    <div v-if="pending" class="space-y-3">
      <div v-for="i in 4" :key="i" class="rounded-2xl border border-ink-200 bg-white p-4">
        <UiSkeletonBlock :lines="3" />
      </div>
    </div>

    <div v-else-if="!rides.length" class="rounded-2xl border border-ink-200 bg-white p-6">
      <AppEmptyState
        icon="history"
        title="Belum ada perjalanan"
        description="Riwayat perjalanan kamu akan muncul di sini setelah kamu selesai bepergian."
      >
        <UiButton to="/customer/book">Pesan Sekarang</UiButton>
      </AppEmptyState>
    </div>

    <div v-else class="space-y-3">
      <RideCard v-for="r in rides" :key="r.id" :ride="r" show-driver />
    </div>

    <!-- Pagination -->
    <div v-if="meta && meta.last_page > 1" class="mt-6 flex items-center justify-center gap-2">
      <UiButton
        variant="outline"
        size="sm"
        icon-only
        :disabled="page <= 1"
        @click="goPage(page - 1)"
      >
        <template #icon><UiIcon name="chevron-left" class="size-4" /></template>
      </UiButton>
      <span class="px-2 text-sm font-semibold text-ink-600">
        {{ page }} / {{ meta.last_page }}
      </span>
      <UiButton
        variant="outline"
        size="sm"
        icon-only
        :disabled="page >= meta.last_page"
        @click="goPage(page + 1)"
      >
        <template #icon><UiIcon name="chevron-right" class="size-4" /></template>
      </UiButton>
    </div>
  </div>
</template>
