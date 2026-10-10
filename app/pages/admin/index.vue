<script setup lang="ts">
import { computed } from 'vue'
import type { ChartPoint, DashboardStats, RideStatus } from '#shared/types'
import { formatRupiah, formatDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Dashboard Admin', robots: 'noindex, nofollow' })

const range = ref(14)

const { data: stats, pending: loadingStats } = await useAsyncData(
  'admin-stats',
  () => http.get<{ data: DashboardStats }>('/admin/stats', { days: range.value }).then(r => r.data),
  { watch: [range] },
)

type TopDriver = {
  id: number
  name: string
  avatar_url: string | null
  vehicle_plate: string | null
  total_rides: number
  gmv: number
  collected_cash: number
}

type ActivityEntry = {
  id: number
  ride_id: number
  ride_code: string | null
  from_status: RideStatus | null
  to_status: RideStatus
  to_status_label: string
  changed_by_role: string
  changed_by_name: string | null
  fare: number
  customer_name: string | null
  driver_name: string | null
  at: string | null
}

/*
 * Backend hanya punya satu deret harian: perjalanan per hari dan GMV per hari
 * bukan dua kumpulan data, cuma dua pembacaan dari yang sama.
 */
const { data: daily } = await useAsyncData(
  'admin-chart-daily',
  () => http.get<{ data: ChartPoint[] }>('/admin/charts/daily', { days: range.value }).then(r => r.data),
  { watch: [range] },
)

const { data: topDrivers } = await useAsyncData(
  'admin-top-drivers',
  () => http.get<{ data: TopDriver[] }>('/admin/top-drivers').then(r => r.data),
)

const { data: activity } = await useAsyncData(
  'admin-activity',
  () => http.get<{ data: ActivityEntry[] }>('/admin/activity').then(r => r.data),
)

const ridesChart = computed(() =>
  (daily.value ?? []).map(p => ({ label: p.label, value: p.rides })),
)
const gmvChart = computed(() =>
  (daily.value ?? []).map(p => ({ label: p.label, value: p.gmv })),
)

const KPIS = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    {
      label: 'Perjalanan (periode)',
      value: s.rides_in_period.toLocaleString('id-ID'),
      delta: s.rides_change_pct,
      icon: 'navigation',
      tone: 'brand',
    },
    {
      label: 'GMV (perjalanan selesai)',
      value: formatRupiah(s.gmv_in_period),
      delta: s.gmv_change_pct,
      icon: 'wallet',
      tone: 'emerald',
    },
    {
      label: 'Driver Online',
      value: s.online_drivers.toLocaleString('id-ID'),
      delta: 0,
      icon: 'bike',
      tone: 'indigo',
    },
    {
      label: 'Rating Rata-rata',
      value: s.average_driver_rating.toFixed(2),
      delta: 0,
      icon: 'star',
      tone: 'amber',
    },
  ]
})

/*
 * Kartu "Pendapatan Platform" dihapus.
 *
 * ADR-035 di backend menetapkan uang tidak pernah singgah di aplikasi, jadi
 * tidak ada komisi dan tidak ada pendapatan platform yang bisa dihitung.
 * Menampilkan "Rp0" akan terlihat seperti bisnis yang belum untung, padahal
 * memang tidak ada angka itu sama sekali. Lihat ADR-038.
 */

const TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  amber: 'bg-amber-50 text-amber-600',
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Dashboard" description="Ringkasan operasional Ansian hari ini.">
      <template #actions>
        <select
          v-model.number="range"
          class="h-9 rounded-xl border border-ink-200 bg-white px-3 text-[12.5px] font-medium text-ink-700 outline-none focus:border-brand-500"
        >
          <option :value="7">7 hari</option>
          <option :value="14">14 hari</option>
          <option :value="30">30 hari</option>
        </select>
      </template>
    </AppPageHeader>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <template v-if="loadingStats && !stats">
        <UiCard v-for="i in 4" :key="`sk-${i}`">
          <UiSkeletonBlock :lines="2" />
        </UiCard>
      </template>
      <UiCard v-for="k in KPIS" v-else :key="k.label">
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <p class="text-[11.5px] font-medium text-ink-500">{{ k.label }}</p>
            <p class="mt-1.5 truncate text-xl font-bold tracking-tight text-ink-900">{{ k.value }}</p>
          </div>
          <span class="grid size-9 shrink-0 place-items-center rounded-xl" :class="TONES[k.tone]">
            <UiIcon :name="k.icon" class="size-4.5" />
          </span>
        </div>
        <p class="mt-3 flex items-center gap-1 text-[11px]">
          <UiIcon
            :name="k.delta >= 0 ? 'trending-up' : 'trending-down'"
            :class="k.delta >= 0 ? 'text-emerald-600' : 'text-red-600'"
            class="size-3.5"
          />
          <span :class="k.delta >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ Math.abs(k.delta) }}%</span>
          <span class="text-ink-400">vs periode lalu</span>
        </p>
      </UiCard>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <UiCard
v-for="s in [
        { label: 'Driver Online', value: `${stats?.online_drivers ?? 0}`, hint: `dari ${stats?.drivers ?? 0} driver` },
        { label: 'Perjalanan Aktif', value: `${stats?.active_rides ?? 0}`, hint: 'sedang berjalan' },
        { label: 'Rata-rata Rating', value: (stats?.average_driver_rating ?? 0).toFixed(2), hint: 'driver yang sudah dinilai' },
        { label: 'Pelanggan', value: `${stats?.customers ?? 0}`, hint: `dari ${stats?.total_users ?? 0} pengguna` },
      ]" :key="s.label">
        <p class="text-[11.5px] text-ink-500">{{ s.label }}</p>
        <p class="mt-1 text-lg font-bold text-ink-900">{{ s.value }}</p>
        <p class="text-[11px] text-ink-400">{{ s.hint }}</p>
      </UiCard>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <UiCard>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-bold text-ink-900">Tren Perjalanan</h3>
          <UiBadge tone="gray">{{ range }} hari</UiBadge>
        </div>
        <ChartsLineChart v-if="ridesChart.length" :series="ridesChart" color="#16a34a" />
        <AppEmptyState v-else title="Belum ada data" description="Grafik muncul setelah ada perjalanan." />
      </UiCard>

      <UiCard>
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-bold text-ink-900">GMV Harian</h3>
          <UiBadge tone="brand">perjalanan selesai</UiBadge>
        </div>
        <ChartsLineChart v-if="gmvChart.length" :series="gmvChart" value-prefix="Rp " color="#4f46e5" />
        <AppEmptyState v-else title="Belum ada data" description="Grafik muncul setelah ada perjalanan selesai." />
      </UiCard>
    </div>

    <div class="grid gap-4 lg:grid-cols-5">
      <UiCard class="lg:col-span-2" :padded="false">
        <div class="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 class="text-sm font-bold text-ink-900">Driver Teratas</h3>
          <UiButton to="/admin/drivers" size="xs" variant="ghost">Lihat semua</UiButton>
        </div>
        <ul class="divide-y divide-ink-100">
          <li v-for="(d, i) in topDrivers ?? []" :key="d.id" class="flex items-center gap-3 px-5 py-3">
            <span class="w-4 text-center text-[12px] font-bold text-ink-400">{{ i + 1 }}</span>
            <UiAvatar :name="d.name" :src="d.avatar_url" :size="34" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-[13px] font-semibold text-ink-900">{{ d.name }}</p>
              <p class="text-[11px] text-ink-400">
                {{ d.vehicle_plate ?? 'Tanpa kendaraan' }} · {{ d.total_rides }} perjalanan
              </p>
            </div>
            <div class="text-right">
              <p class="text-[12.5px] font-bold text-ink-900">{{ formatRupiah(d.gmv) }}</p>
              <p class="text-[11px] text-ink-400">GMV selesai</p>
            </div>
          </li>
          <li v-if="!topDrivers?.length" class="px-5 py-8 text-center text-[13px] text-ink-400">
            Belum ada data driver.
          </li>
        </ul>
      </UiCard>

      <UiCard class="lg:col-span-3" :padded="false">
        <div class="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
          <h3 class="text-sm font-bold text-ink-900">Aktivitas Terbaru</h3>
          <UiButton to="/admin/rides" size="xs" variant="ghost">Kelola perjalanan</UiButton>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead>
              <tr class="border-b border-ink-100 text-[11px] tracking-wide text-ink-400 uppercase">
                <th class="px-5 py-2.5 font-semibold">Perjalanan</th>
                <th class="px-3 py-2.5 font-semibold">Pelanggan</th>
                <th class="px-3 py-2.5 font-semibold">Driver</th>
                <th class="px-3 py-2.5 font-semibold">Perubahan Status</th>
                <th class="px-3 py-2.5 text-right font-semibold">Tarif</th>
                <th class="px-5 py-2.5 text-right font-semibold">Waktu</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in activity ?? []" :key="a.id" class="border-b border-ink-50 last:border-0">
                <td class="px-5 py-2.5 font-mono text-[12px] text-ink-700">{{ a.ride_code ?? '-' }}</td>
                <td class="max-w-[10rem] truncate px-3 py-2.5 text-[12.5px] text-ink-700">
                  {{ a.customer_name ?? '-' }}
                </td>
                <td class="max-w-[10rem] truncate px-3 py-2.5 text-[12.5px] text-ink-500">
                  {{ a.driver_name ?? '-' }}
                </td>
                <td class="px-3 py-2.5">
                  <span v-if="a.from_status" class="text-[11px] text-ink-400 line-through">{{ a.from_status }}</span>
                  <span v-if="a.from_status" class="mx-1 text-[11px] text-ink-300">&rarr;</span>
                  <RideStatusBadge :status="a.to_status" size="sm" />
                </td>
                <td class="px-3 py-2.5 text-right text-[12.5px] font-semibold text-ink-900">
                  {{ a.fare ? formatRupiah(a.fare) : '-' }}
                </td>
                <td class="px-5 py-2.5 text-right text-[11.5px] text-ink-400">{{ formatDateTime(a.at) }}</td>
              </tr>
              <tr v-if="!activity?.length">
                <td colspan="6" class="px-5 py-10 text-center text-[13px] text-ink-400">
                  Belum ada perubahan status perjalanan.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiCard>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <UiCard>
        <p class="text-[11.5px] text-ink-500">Tingkat Penyelesaian</p>
        <p class="mt-1 text-lg font-bold text-emerald-600">{{ stats?.completion_rate ?? 0 }}%</p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full bg-emerald-500" :style="{ width: `${stats?.completion_rate ?? 0}%` }" />
        </div>
      </UiCard>
      <UiCard>
        <p class="text-[11.5px] text-ink-500">Tingkat Pembatalan</p>
        <p class="mt-1 text-lg font-bold text-red-600">{{ stats?.cancellation_rate ?? 0 }}%</p>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
          <div class="h-full rounded-full bg-red-500" :style="{ width: `${stats?.cancellation_rate ?? 0}%` }" />
        </div>
      </UiCard>
      <UiCard>
        <p class="text-[11.5px] text-ink-500">Rata-rata Tarif</p>
        <p class="mt-1 text-lg font-bold text-ink-900">{{ formatRupiah(stats?.average_fare ?? 0) }}</p>
        <p class="mt-1 text-[11px] text-ink-400">dari perjalanan selesai dalam periode</p>
      </UiCard>
    </div>

    <p class="text-center text-[11px] text-ink-300">
      Data diperbarui otomatis dari API setiap kali halaman dimuat.
    </p>
  </div>
</template>
