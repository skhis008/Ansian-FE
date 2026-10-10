<script setup lang="ts">
import type { Ride, RideStatus } from '#shared/types'
import { RIDE_STATUS_LABELS, RIDE_TERMINAL_STATUSES } from '#shared/types'
import { formatTime } from '#shared/utils/format'

const props = defineProps<{ ride: Ride }>()

const STEPS: { status: Ride['status']; label: string; icon: string }[] = [
  { status: 'searching', label: 'Mencari driver', icon: 'search' },
  { status: 'driver_assigned', label: 'Driver menuju lokasi', icon: 'car' },
  { status: 'driver_arrived', label: 'Driver tiba', icon: 'map-pin' },
  { status: 'in_progress', label: 'Dalam perjalanan', icon: 'navigation' },
  { status: 'completed', label: 'Selesai', icon: 'check' },
]

const currentIndex = computed(() => {
  const map: Partial<Record<Ride['status'], number>> = {
    searching: 0,
    driver_assigned: 1,
    driver_arrived: 2,
    in_progress: 3,
    completed: 4,
  }
  return map[props.ride.status] ?? -1
})

// Backend mencatat `to_status`, bukan `status`, jadi pencocokan memakai
// field itu. Kalau tetap `h.status`, hasilnya selalu `undefined` dan setiap
// langkah timeline kehilangan keterangan waktunya tanpa error.
const historyFor = (status: Ride['status']) =>
  [...props.ride.status_histories].reverse().find(h => h.to_status === status)

const isTerminal = computed(() => (RIDE_TERMINAL_STATUSES as readonly RideStatus[]).includes(props.ride.status))
</script>

<template>
  <div>
    <div v-if="isTerminal" class="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
      <UiIcon name="alert-triangle" class="mt-0.5 size-5 shrink-0 text-red-600" />
      <div>
        <p class="text-sm font-semibold text-red-800">
          Perjalanan {{ RIDE_STATUS_LABELS[ride.status] }}
        </p>
        <p class="mt-0.5 text-xs text-red-700">
          {{ ride.status_histories[ride.status_histories.length - 1]?.note || RIDE_STATUS_LABELS[ride.status] }}
        </p>
      </div>
    </div>

    <ol v-else class="relative space-y-0">
      <li v-for="(step, i) in STEPS" :key="step.status" class="relative flex gap-3.5 pb-5 last:pb-0">
        <div class="flex flex-col items-center">
          <span
            class="grid size-8 shrink-0 place-items-center rounded-full border-2 transition"
            :class="[
              i < currentIndex ? 'border-emerald-500 bg-emerald-500 text-white' : '',
              i === currentIndex ? 'border-brand-600 bg-brand-600 text-white ring-4 ring-brand-100' : '',
              i > currentIndex ? 'border-ink-200 bg-white text-ink-300' : '',
            ]"
          >
            <UiIcon :name="i < currentIndex ? 'check' : step.icon" class="size-4" />
          </span>
          <span
            v-if="i < STEPS.length - 1"
            class="mt-1 w-0.5 flex-1 rounded-full"
            :class="i < currentIndex ? 'bg-emerald-400' : 'bg-ink-200'"
          />
        </div>

        <div class="min-w-0 flex-1 pt-1">
          <p
            class="text-sm font-semibold"
            :class="i <= currentIndex ? 'text-ink-900' : 'text-ink-400'"
          >
            {{ step.label }}
          </p>
          <p v-if="historyFor(step.status)" class="mt-0.5 text-xs text-ink-500">
            {{ formatTime(historyFor(step.status)!.at) }}
            <span v-if="historyFor(step.status)?.note"> · {{ historyFor(step.status)?.note }}</span>
          </p>
          <p v-else-if="i === currentIndex" class="mt-0.5 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600">
            <span class="flex gap-0.5">
              <span class="size-1 animate-bounce-dot rounded-full bg-current" />
              <span class="size-1 animate-bounce-dot rounded-full bg-current [animation-delay:150ms]" />
              <span class="size-1 animate-bounce-dot rounded-full bg-current [animation-delay:300ms]" />
            </span>
            Sedang berjalan
          </p>
        </div>
      </li>
    </ol>
  </div>
</template>
