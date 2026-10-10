<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { LatLng, Ride } from '#shared/types'
import { currentPosition, samePoint } from '#shared/utils/geo'
import { formatDuration, formatRupiah } from '#shared/utils/format'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Perjalanan Aktif', robots: 'noindex, nofollow' })

const auth = useAuthStore()
const driver = useDriverStore()
const rideStore = useRideStore()
const chat = useChatStore()
const toast = useToast()
const realtime = useRealtime()

if (auth.isDriver && auth.driver) driver.sync(auth.driver)

const busy = ref(false)
const myPosition = ref<LatLng | null>(null)
const routePoints = ref<LatLng[]>([])
const arrived = computed(() => rideStore.activeRide?.status === 'driver_arrived')
const headingToPickup = computed(() => rideStore.activeRide?.status === 'driver_assigned')
const headingToDestination = computed(() => rideStore.activeRide?.status === 'in_progress')
const target = computed<LatLng | null>(() => {
  const r = rideStore.activeRide
  if (!r) return null
  return headingToDestination.value ? r.destination : r.pickup
})
const targetPlace = computed(() =>
  headingToDestination.value ? rideStore.activeRide?.destination : rideStore.activeRide?.pickup,
)
const targetLabel = computed(() => {
  if (headingToPickup.value) return 'Menuju lokasi jemput'
  if (arrived.value) return 'Menunggu di lokasi jemput'
  return 'Menuju tujuan'
})
const phaseLabel = computed(() => {
  if (headingToPickup.value) return 'Ke jemput'
  if (arrived.value) return 'Di jemput'
  return 'Berjalan'
})

const { data: ride, refresh } = await useAsyncData('driver-active-ride', async () => {
  await rideStore.fetchActive()
  return rideStore.activeRide
})

async function track() {
  const pos = await currentPosition()
  myPosition.value = pos
  if (auth.user) {
    await driver.updateLocation(pos.lat, pos.lng)
    realtime.sendLocation(auth.user.id, pos.lat, pos.lng)
  }
  if (ride.value) {
    const pts = await http.get<{ data: LatLng[] }>(`/rides/${ride.value.id}/route`).then(r => r.data)
    routePoints.value = pts
    if (headingToPickup.value && target.value && samePoint(pos, target.value, 60)) {
      toast.info('Kamu sudah sampai di lokasi jemput.')
    }
  }
}

onMounted(async () => {
  rideStore.startPolling(6000)
  await track()
})

onBeforeUnmount(() => rideStore.stopPolling())

watch(
  () => rideStore.activeRide?.status,
  async status => {
    if (!status) return
    await refresh()
    if (status === 'completed') {
      rideStore.stopPolling()
      toast.success('Perjalanan selesai. Terima kasih!')
    }
  },
)

async function advance() {
  if (!ride.value) return
  busy.value = true
  try {
    const endpoint = arrived.value ? 'start' : 'arrive'
    const res = await http.post<{ data: Ride }>(`/rides/${ride.value.id}/${endpoint}`)
    rideStore.setActive(res.data)
    await refresh()
    toast.success(
      arrived.value ? 'Perjalanan dimulai. Hati-hati di jalan!' : 'Pelanggan sudah tiba di lokasi jemput.',
    )
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal memperbarui status.')
  } finally {
    busy.value = false
  }
}

async function complete() {
  if (!ride.value) return
  busy.value = true
  try {
    await http.post(`/rides/${ride.value.id}/complete`)
    rideStore.stopPolling()
    toast.success('Perjalanan selesai! Pendapatanmu sudah masuk.')
    await driver.fetchEarnings()
    await navigateTo('/driver')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal menyelesaikan perjalanan.')
  } finally {
    busy.value = false
  }
}

async function openChat() {
  if (!ride.value) return
  await chat.openConversation(ride.value.ride_code)
  await navigateTo('/driver/chat')
}
</script>

<template>
  <div class="space-y-5">
    <AppPageHeader title="Perjalanan Aktif" :description="ride?.ride_code">
      <template #actions>
        <RideStatusBadge v-if="rideStore.activeRide" :status="rideStore.activeRide.status" />
        <UiButton variant="outline" size="sm" @click="openChat">
          <template #icon><UiIcon name="message-circle" class="size-4" /></template>
          Chat
        </UiButton>
      </template>
    </AppPageHeader>

    <div v-if="!rideStore.activeRide" class="rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center">
      <span class="mx-auto grid size-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
        <UiIcon name="navigation" class="size-6" />
      </span>
      <p class="mt-4 text-sm font-bold text-ink-800">Tidak ada perjalanan aktif</p>
      <p class="mx-auto mt-1 max-w-sm text-xs text-ink-500">
        Terima permintaan baru untuk mulai mengantar pelanggan.
      </p>
      <UiButton class="mt-5" to="/driver/requests">Lihat Permintaan</UiButton>
    </div>

    <div v-else class="grid gap-5 lg:grid-cols-5">
      <!-- Peta -->
      <div class="space-y-4 lg:col-span-3">
        <UiCard :padded="false" class="overflow-hidden">
          <ClientOnly>
            <MapCanvas
              :center="target ?? undefined"
              :route="routePoints"
              :my-location="!!myPosition"
              :driver="myPosition"
              :destination="rideStore.activeRide.destination"
              :pickup="rideStore.activeRide.pickup"
              height="h-[26rem]"
            />
            <template #fallback>
              <div class="grid h-[26rem] place-items-center bg-ink-100"><UiSkeletonBlock :lines="1" /></div>
            </template>
          </ClientOnly>
        </UiCard>

        <UiCard>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[11px] font-semibold text-ink-500">{{ targetLabel }}</p>
              <p class="mt-1 text-base font-bold text-ink-900">{{ targetPlace?.place_name }}</p>
              <p class="text-xs text-ink-500">{{ targetPlace?.address }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-lg font-bold text-emerald-600">{{ formatRupiah(rideStore.activeRide.fare * 0.8) }}</p>
              <p class="text-[10px] text-ink-400">terima 80%</p>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-center">
            <div>
              <p class="text-[10px] text-ink-400">Jarak</p>
              <p class="text-sm font-bold text-ink-900">
                {{ (rideStore.activeRide.distance_km ?? 0).toFixed(1) }} km
              </p>
            </div>
            <div>
              <p class="text-[10px] text-ink-400">Estimasi</p>
              <p class="text-sm font-bold text-ink-900">{{ formatDuration(rideStore.activeRide.duration_min ?? 0) }}</p>
            </div>
            <div>
              <p class="text-[10px] text-ink-400">Status</p>
              <p class="text-sm font-bold text-brand-600">{{ phaseLabel }}</p>
            </div>
          </div>
        </UiCard>
      </div>

      <!-- Sidebar aksi -->
      <div class="space-y-4 lg:col-span-2">
        <UiCard v-if="rideStore.activeRide.customer">
          <h2 class="text-sm font-bold text-ink-900">Pelanggan</h2>
          <div class="mt-3 flex items-center gap-3">
            <UiAvatar :name="rideStore.activeRide.customer.name" :src="rideStore.activeRide.customer.avatar_url" :size="44" />
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-ink-900">{{ rideStore.activeRide.customer.name }}</p>
              <p class="flex items-center gap-1 text-[11px] text-ink-500">
                <UiIcon name="star" class="size-3 fill-amber-400 text-amber-400" />
                {{ rideStore.activeRide.customer.rating ?? 'Baru' }} · {{ rideStore.activeRide.customer.rating_count }} ulasan
              </p>
            </div>
          </div>
          <p v-if="rideStore.activeRide.customer.phone" class="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-600">
            {{ rideStore.activeRide.customer.phone }}
          </p>
        </UiCard>

        <UiCard>
          <h2 class="text-sm font-bold text-ink-900">Alamat</h2>
          <ol class="mt-3 space-y-3">
            <li class="flex items-start gap-2.5">
              <span class="mt-1 grid size-4 shrink-0 place-items-center rounded-full border-2 border-ink-900" />
              <div class="min-w-0">
                <p class="text-[10px] text-ink-400 uppercase">Jemput</p>
                <p class="text-[13px] font-semibold text-ink-800">{{ rideStore.activeRide.pickup.address }}</p>
              </div>
            </li>
            <li class="flex items-start gap-2.5">
              <span class="mt-1 size-4 shrink-0 rounded-full bg-rose-600" />
              <div class="min-w-0">
                <p class="text-[10px] text-ink-400 uppercase">Tujuan</p>
                <p class="text-[13px] font-semibold text-ink-800">{{ rideStore.activeRide.destination.address }}</p>
              </div>
            </li>
          </ol>
        </UiCard>

        <UiCard>
          <UiButton v-if="rideStore.activeRide.status === 'driver_assigned'" block size="lg" :loading="busy" @click="advance">
            <template #icon><UiIcon name="map-pin" class="size-4" /></template>
            Saya sudah tiba
          </UiButton>
          <UiButton v-else-if="rideStore.activeRide.status === 'driver_arrived'" block size="lg" :loading="busy" @click="advance">
            <template #icon><UiIcon name="navigation" class="size-4" /></template>
            Mulai perjalanan
          </UiButton>
          <UiButton v-else block size="lg" variant="success" :loading="busy" @click="complete">
            <template #icon><UiIcon name="check" class="size-4" /></template>
            Selesaikan perjalanan
          </UiButton>

          <div class="mt-2 grid grid-cols-2 gap-2">
            <UiButton variant="outline" size="sm" block @click="track">
              <template #icon><UiIcon name="refresh-cw" class="size-4" /></template>
              Update lokasi
            </UiButton>
            <UiButton variant="outline" size="sm" block to="/driver/requests">
              Batalkan
            </UiButton>
          </div>
        </UiCard>
      </div>
    </div>
  </div>
</template>
