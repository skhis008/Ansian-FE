<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatDistance, formatRupiah } from '#shared/utils/format'
import { isRideCancelled, isRideSettled, RIDE_STATUS_LABELS } from '#shared/types'

definePageMeta({ layout: 'app' })
useSeoMeta({ title: 'Perjalanan Aktif', robots: 'noindex, nofollow' })

const rideStore = useRideStore()
const chat = useChatStore()
const toast = useToast()
const router = useRouter()
const route = useRoute()
const realtime = useRealtime()

const cancelOpen = ref(false)
const rateOpen = ref(false)
const cancelling = ref(false)
const searchingSeconds = ref(0)
let searchTimer: ReturnType<typeof setInterval> | null = null

const ride = computed(() => rideStore.activeRide)

/* Ambil perjalanan dari query (?id=) atau dari API */
onMounted(async () => {
  const id = route.query.id
  if (id && !ride.value) {
    try {
      const res = await http.get<{ data: any }>(`/rides/${id}`)
      rideStore.mergeRide(res.data)
    } catch {
      /* ignore */
    }
  }
  if (!ride.value) await rideStore.fetchActive(false)

  if (ride.value?.ride_code) realtime.bindRide(ride.value.ride_code)

  if (ride.value?.status === 'searching') {
    searchTimer = setInterval(() => searchingSeconds.value++, 1000)
  }
})

onBeforeUnmount(() => {
  if (searchTimer) clearInterval(searchTimer)
  rideStore.stopPolling()
})

/* Mode mock: server mensimulasikan dispatch otomatis, jadi halaman cukup polling. */
watch(
  () => ride.value?.status,
  (status, prev) => {
    if (status === 'searching') {
      if (!searchTimer) searchTimer = setInterval(() => searchingSeconds.value++, 1000)
      rideStore.startPolling(4000)
    } else {
      if (searchTimer) {
        clearInterval(searchTimer)
        searchTimer = null
      }
      rideStore.stopPolling()
    }
    if (status === 'driver_assigned' && prev === 'searching') {
      toast.success('Driver ditemukan! Menuju lokasi jemput.')
    }
  },
  { immediate: true },
)

const driver = computed(() => ride.value?.driver ?? null)

const routePoints = computed(() => {
  const r = ride.value
  if (!r) return null
  if (r.status === 'in_progress' && rideStore.quote?.route) return rideStore.quote.route
  return null
})

const driverTracking = computed(() => rideStore.activeRide?.status === 'in_progress' ? useDriverStore().trackingLocation : null)

const etaText = computed(() => {
  if (!ride.value) return '—'
  const d = distanceKmBetween()
  const speed = 26
  return `${Math.max(1, Math.round((d / speed) * 60))} menit`
})

function distanceKmBetween() {
  const r = ride.value
  const dloc = driverTracking.value
  if (r && dloc) return Math.max(0.2, ride.value!.distance_km * 0.4)
  return r?.distance_km ?? 0
}

async function confirmCancel() {
  if (!ride.value) return
  cancelling.value = true
  try {
    const res = await rideStore.transition(ride.value.id, 'cancel', { reason: 'customer_cancel' })
    cancelOpen.value = false
    toast.success('Perjalanan dibatalkan.')
    if (res.data) {
      await router.push(`/customer/rides/${ride.value.id}`)
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal membatalkan.')
  } finally {
    cancelling.value = false
  }
}

async function submitRating(payload: { score: number; comment: string | null; tags: string[] }) {
  if (!ride.value) return
  try {
    await rideStore.transition(ride.value.id, 'rate', payload)
    rateOpen.value = false
    toast.success('Terima kasih atas rating kamu!')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Gagal mengirim rating.')
  }
}

async function openChat() {
  if (!ride.value) return
  const conv = await chat.openConversation(ride.value.ride_code)
  await router.push(conv ? `/customer/chat/${conv.id}` : '/customer/chat')
}
</script>

<template>
  <div>
    <div v-if="!ride" class="mx-auto max-w-lg py-10">
      <AppEmptyState
        icon="car"
        title="Tidak ada perjalanan aktif"
        description="Kamu belum punya perjalanan yang sedang berjalan."
      >
        <UiButton to="/customer/book">Pesan Sekarang</UiButton>
      </AppEmptyState>
    </div>

    <div v-else class="space-y-5">
      <!-- Status header -->
      <div class="rounded-2xl bg-gradient-to-r from-ink-900 to-brand-900 p-5 text-white shadow-lift">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs font-medium tracking-wide text-white/60 uppercase">Status</p>
            <h1 class="mt-1 flex items-center gap-2 text-xl font-bold">
              <span
                v-if="!isRideSettled(ride.status)"
                class="flex gap-1"
              >
                <span class="size-1.5 animate-bounce-dot rounded-full bg-white" />
                <span class="size-1.5 animate-bounce-dot rounded-full bg-white [animation-delay:150ms]" />
                <span class="size-1.5 animate-bounce-dot rounded-full bg-white [animation-delay:300ms]" />
              </span>
              {{ RIDE_STATUS_LABELS[ride.status] }}
            </h1>
            <p class="mt-1.5 font-mono text-xs text-white/60">{{ ride.ride_code }}</p>
          </div>
          <div class="text-right">
            <p class="text-xs text-white/60">Estimasi tiba</p>
            <p class="text-2xl font-bold">{{ etaText }}</p>
            <p class="text-[11px] text-white/60">{{ formatDistance(ride.distance_km) }}</p>
          </div>
        </div>

        <!-- Progress bar -->
        <div v-if="!isRideCancelled(ride.status)" class="mt-5 flex items-center gap-1.5">
          <span
            v-for="i in 4"
            :key="i"
            class="h-1.5 flex-1 rounded-full transition-colors"
            :class="rideStore.progressStep >= i ? 'bg-brand-400' : 'bg-white/20'"
          />
        </div>
      </div>

      <!-- Searching state -->
      <UiCard v-if="ride.status === 'searching'" class="text-center">
        <div class="mx-auto flex max-w-sm flex-col items-center py-4">
          <div class="relative">
            <span class="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <UiIcon name="search" class="size-7 animate-pulse" />
            </span>
            <span class="absolute inset-0 animate-ping rounded-2xl bg-brand-200/40" />
          </div>
          <h3 class="mt-4 text-base font-bold text-ink-900">Mencari driver terdekat…</h3>
          <p class="mt-1 text-sm text-ink-500">
            Sudah menunggu {{ searchingSeconds }} detik
          </p>
          <div class="mt-5 w-full max-w-xs space-y-2">
            <p class="text-[11px] font-medium text-ink-400">Driver biasanya datang dalam 2-4 menit</p>
            <div class="h-1.5 overflow-hidden rounded-full bg-ink-100">
              <div class="h-full w-1/3 animate-pulse rounded-full bg-brand-500" />
            </div>
          </div>
          <div class="mt-5 flex gap-2">
            <UiButton to="/customer/chat" variant="outline" size="sm">
              <template #icon><UiIcon name="message-circle" class="size-4" /></template>
              Chat CS
            </UiButton>
            <UiButton variant="ghost" size="sm" @click="cancelOpen = true">Batalkan</UiButton>
          </div>
        </div>
      </UiCard>

      <div class="grid gap-5 lg:grid-cols-5">
        <!-- Map -->
        <div class="lg:col-span-3">
          <UiCard :padded="false" class="overflow-hidden">
            <ClientOnly>
              <MapCanvas
                :pickup="ride.pickup"
                :destination="ride.destination"
                :route="routePoints"
                :driver="driverTracking ?? (driver ? { lat: driver.lat!, lng: driver.lng! } : null)"
                height="h-[24rem] lg:h-[32rem]"
              />
            </ClientOnly>
          </UiCard>
        </div>

        <!-- Sidebar -->
        <div class="space-y-4 lg:col-span-2">
          <!-- Driver -->
          <RideDriverCard v-if="driver" :driver="driver" :eta="ride.status === 'in_progress' ? undefined : 4" />
          <UiCard v-else-if="ride.status !== 'searching'">
            <div class="flex items-center gap-3">
              <UiSkeletonBlock :lines="2" class="flex-1" />
            </div>
          </UiCard>

          <!-- Aksi -->
          <div class="grid grid-cols-2 gap-2">
            <UiButton variant="outline" size="sm" block @click="openChat">
              <template #icon><UiIcon name="message-circle" class="size-4" /></template>
              Chat Driver
            </UiButton>
            <UiButton
              v-if="ride.driver"
              variant="outline"
              size="sm"
              block
              :href="`tel:${ride.driver.user.phone}`"
            >
              <template #icon><UiIcon name="phone" class="size-4" /></template>
              Telepon
            </UiButton>
          </div>

          <!-- Ringkasan -->
          <UiCard>
            <div class="flex items-start gap-3">
              <div class="flex flex-col items-center pt-1">
                <span class="size-2.5 rounded-full border-2 border-ink-900" />
                <span class="my-0.5 w-px flex-1 bg-ink-200" />
                <span class="size-2.5 rounded-full bg-rose-600" />
              </div>
              <div class="min-w-0 flex-1 space-y-3">
                <div>
                  <p class="text-[10px] font-medium tracking-wide text-ink-400 uppercase">Jemput</p>
                  <p class="text-sm font-semibold text-ink-900">{{ ride.pickup.address }}</p>
                </div>
                <div>
                  <p class="text-[10px] font-medium tracking-wide text-ink-400 uppercase">Tujuan</p>
                  <p class="text-sm font-semibold text-ink-900">{{ ride.destination.address }}</p>
                </div>
                <div v-if="ride.pickup_note" class="rounded-lg bg-amber-50 px-2.5 py-2">
                  <p class="text-[10px] font-medium text-amber-700 uppercase">Catatan</p>
                  <p class="text-xs text-amber-900">{{ ride.pickup_note }}</p>
                </div>
              </div>
            </div>

            <dl class="mt-4 space-y-2 border-t border-ink-100 pt-4 text-sm">
              <div class="flex justify-between">
                <dt class="text-ink-500">Jarak</dt>
                <dd class="font-semibold text-ink-800">{{ formatDistance(ride.distance_km) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-ink-500">Estimasi durasi</dt>
                <dd class="font-semibold text-ink-800">{{ ride.duration_min }} menit</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-ink-500">Pembayaran</dt>
                <dd class="font-semibold text-ink-800 uppercase">{{ ride.payment_method }}</dd>
              </div>
              <div class="flex justify-between border-t border-ink-100 pt-2">
                <dt class="font-semibold text-ink-900">Total</dt>
                <dd class="text-lg font-bold text-ink-900">{{ formatRupiah(ride.fare) }}</dd>
              </div>
            </dl>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <UiButton
                v-if="ride.status === 'completed' && !ride.rating"
                variant="primary"
                size="sm"
                block
                @click="rateOpen = true"
              >
                <template #icon><UiIcon name="star" class="size-4" /></template>
                Beri Rating
              </UiButton>
              <UiButton
                v-if="rideStore.canCancel"
                variant="outline"
                size="sm"
                block
                @click="cancelOpen = true"
              >
                Batalkan
              </UiButton>
              <UiButton
                v-if="ride.status === 'completed'"
                to="/customer/book"
                variant="primary"
                size="sm"
                block
              >
                Pesan Lagi
              </UiButton>
            </div>
          </UiCard>

          <!-- Timeline -->
          <UiCard>
            <h3 class="mb-4 text-sm font-bold text-ink-900">Progres Perjalanan</h3>
            <RideTimeline :ride="ride" />
          </UiCard>
        </div>
      </div>
    </div>

    <!-- Cancel modal -->
    <UiModal
      :open="cancelOpen"
      title="Batalkan perjalanan?"
      description="Driver yang sudah menerima order mungkin tidak bisa menerima pembatalan."
      size="sm"
      @close="cancelOpen = false"
    >
      <div class="space-y-2.5">
        <p class="text-sm text-ink-600">Alasan pembatalan:</p>
        <div class="space-y-2">
          <label v-for="r in ['Jemputan berubah', 'Tidak jadi bepergian', 'Harga terlalu mahal', 'Lainnya']" :key="r" class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2.5 text-sm transition hover:bg-ink-50">
            <input type="radio" name="alert-circle" value="customer_cancel" class="size-4 text-brand-600">
            {{ r }}
          </label>
        </div>
      </div>
      <template #footer>
        <UiButton variant="ghost" @click="cancelOpen = false">Kembali</UiButton>
        <UiButton variant="danger" :loading="cancelling" @click="confirmCancel">Ya, Batalkan</UiButton>
      </template>
    </UiModal>

    <!-- Rate modal -->
    <RideRateModal :open="rateOpen" :ride="ride" @close="rateOpen = false" @submitted="submitRating" />
  </div>
</template>
