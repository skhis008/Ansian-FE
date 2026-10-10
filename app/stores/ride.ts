import { defineStore } from 'pinia'
import {
  canRideTransitionTo,
  isRideActive,
  normalizeRide,
  normalizeRides,
  type RideResourceShape,
  type FareQuote,
  type PaymentMethod,
  type Place,
  type Ride,
  type RideStatus,
} from '#shared/types'
import { http, ApiError } from '~/composables/useApi'
import { useToast } from '~/composables/useToast'

interface RideState {
  activeRide: Ride | null
  quote: FareQuote | null
  quoting: boolean
  booking: boolean
  lastError: string | null
  polling: boolean
}

/**
 * Tabel transisi TIDAK ditulis di sini. Sumbernya `RIDE_NEXT` di
 * `#shared/types`, yang mencerminkan `RideStatus::allowedNext()` di backend.
 *
 * Salinan lokal pernah menyimpang dari backend tanpa ketahuan: frontend punya
 * dua status pembatalan, backend punya empat, dan tidak ada yang bisa
 * GruFeedback hal itu karena dua-duanya syntaksnya benar.
 */

export const useRideStore = defineStore('ride', {
  state: (): RideState => ({
    activeRide: null,
    quote: null,
    quoting: false,
    booking: false,
    lastError: null,
    polling: false,
  }),

  getters: {
    hasActiveRide: state => Boolean(state.activeRide && ['searching', 'driver_assigned', 'driver_arrived', 'in_progress'].includes(state.activeRide.status)),
    status: state => state.activeRide?.status ?? null,
    canCancel: state => Boolean(state.activeRide && ['searching', 'driver_assigned', 'driver_arrived'].includes(state.activeRide.status)),
    progressStep: state => {
      const map: Partial<Record<RideStatus, number>> = {
        searching: 1,
        driver_assigned: 2,
        driver_arrived: 3,
        in_progress: 4,
        completed: 5,
      }
      return state.activeRide ? (map[state.activeRide.status] ?? 0) : 0
    },
  },

  actions: {
    setActive(ride: Ride | null) {
      this.activeRide = ride
    },

    /**
     * Perjalanan yang sedang berjalan milik pengguna ini.
     *
     * Backend menjawab daftar, bukan satu objek: `GET /rides?scope=active`
     * dengan `per_page=1` jadi sumbernya, dan ride pertama yang dipakai. Meminta
     * satu perjalanan lalu menghitung sendiri statusnya di klien akan menyimpang
     * dari server begitu ada status baru yang tidak diketahui FE.
     */
    async fetchActive(silent = true) {
      try {
        const res = await http.get<{ data?: RideResourceShape[] }>('/rides', { scope: 'active', per_page: 1 }, { silent })
        const ride = normalizeRides(res)[0] ?? null
        this.activeRide = ride
        return ride
      } catch {
        return this.activeRide
      }
    },

    /**
     * Minta pratinjau tarif ke server.
     *
     * Sengaja lewat `POST /rides/preview`, bukan endpoint `/fares/quote` yang
     * pernah ada di mock: hanya backend yang menghitung tarif, dan_nodesan
     * endpoint lain akan_bundle dua versi aturan tarif yang pasti akan menyimpang.
     */
    async getQuote(input: {
      vehicleTypeId: number
      pickup: Place
      destination: Place
      promoCode?: string | null
    }) {
      this.quoting = true
      this.lastError = null
      try {
        const res = await http.post<{ data: FareQuote }>('/rides/preview', {
          vehicle_type_id: input.vehicleTypeId,
          pickup_lat: input.pickup.lat,
          pickup_lng: input.pickup.lng,
          dropoff_lat: input.destination.lat,
          dropoff_lng: input.destination.lng,
          promo_code: input.promoCode ?? null,
        })
        this.quote = res.data
        return res.data
      } catch (e) {
        this.lastError = e instanceof ApiError ? e.message : 'Gagal menghitung ongkos.'
        this.quote = null
        return null
      } finally {
        this.quoting = false
      }
    }

    async book(payload: {
      vehicleTypeId: number
      pickup: Place
      destination: Place
      pickupNote?: string | null
      promoCode?: string | null
    }) {
      this.booking = true
      try {
        // Backend menerima alamat dan koordinat datar, bukan objek `Place` bersarang,
        // dan membalas dengan `RideResource`. Dinormalkan supaya seluruh sisa
        // aplikasi tetap lihat satu bentuk perjalanan.
        const res = await http.post<{ data: RideResourceShape }>('/rides', {
          vehicle_type_id: payload.vehicleTypeId,
          pickup_address: payload.pickup.address,
          pickup_lat: payload.pickup.lat,
          pickup_lng: payload.pickup.lng,
          pickup_note: payload.pickupNote ?? null,
          dropoff_address: payload.destination.address,
          dropoff_lat: payload.destination.lat,
          dropoff_lng: payload.destination.lng,
          promo_code: payload.promoCode ?? null,
        })
        const ride = normalizeRide(res.data)
        this.activeRide = ride
        this.quote = null
        return ride
      } finally {
        this.booking = false
      }
    }

    /** Update status perjalanan (dipakai driver & polling) */
    async transition(rideId: number, action: 'cancel' | 'arrive' | 'start' | 'complete' | 'rate', data: Record<string, unknown> = {}) {
      const paths: Record<string, string> = {
        cancel: `/rides/${rideId}/cancel`,
        arrive: `/rides/${rideId}/arrive`,
        start: `/rides/${rideId}/start`,
        complete: `/rides/${rideId}/complete`,
        rate: `/rides/${rideId}/rating`,
      }
      const res = await http.post<{ data: Ride; message?: string }>(paths[action]!, data)
      this.mergeRide(res.data)
      return res
    },

    acceptJob(rideId: number) {
      return http.post<{ data: Ride }>(`/rides/${rideId}/accept`)
    },
    rejectJob(rideId: number) {
      return http.post(`/drivers/jobs/${rideId}/reject`)
    },

    mergeRide(ride: Ride) {
      if (this.activeRide && this.activeRide.id === ride.id) {
        this.activeRide = ride
      } else if (isRideActive(ride.status)) {
        this.activeRide = ride
      } else if (this.activeRide?.id === ride.id) {
        this.activeRide = ride
      }
    },

    /**
     * Dipakai realtime: tolak transisi yang lompat tahap.
     *
     * Ini bukan otoritatif — backend yang memutuskan, dan ia menjawab `409
     * invalid_transition` kalau lompat. Yang dicek di sini supaya tampilan tidak
     * sempat menunjukkan status yang memang tidak akan pernah diterima server.
     */
    applyRealtimeStatus(rideId: number, status: RideStatus) {
      const current = this.activeRide
      if (!current || current.id !== rideId) return false
      if (current.status === status) return false
      if (!canRideTransitionTo(current.status, status)) return false
      current.status = status
      current.updated_at = new Date().toISOString()
      return true
    },

    clear() {
      this.activeRide = null
      this.quote = null
    },

    /** Polling ringan: berbeda dari realtime, dipakai saat Echo belum aktif */
    startPolling(intervalMs = 6000) {
      if (this.polling) return
      this.polling = true
      const tick = async () => {
        if (!this.polling) return
        await this.fetchActive()
        setTimeout(tick, intervalMs)
      }
      setTimeout(tick, intervalMs)
      void useToast()
    },

    stopPolling() {
      this.polling = false
    },
  },
})
