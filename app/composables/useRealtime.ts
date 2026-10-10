import { isRideCancelled, type AppNotification, type ChatMessage, type Ride, type RideStatus } from '#shared/types'
import { http } from '~/composables/useApi'

type ChannelNames = {
  user: (id: number) => string
  ride: (code: string) => string
  driverLocation: (id: number) => string
  adminDashboard: string
}

export const channels: ChannelNames = {
  // Private channel — Laravel: Broadcast::channel('App.Models.User.{id}')
  user: id => `App.Models.User.${id}`,
  // Private channel — Laravel: Broadcast::channel('ride.{code}')
  ride: code => `ride.${code}`,
  // Presence channel — lokasi driver
  driverLocation: id => `driver-location.${id}`,
  adminDashboard: 'admin-dashboard',
}

export interface RideStatusEvent {
  ride_id: number
  ride_code: string
  status: RideStatus
  driver?: Ride['driver']
  eta_min?: number
  distance_km?: number
}

export interface DriverLocationEvent {
  driver_id: number
  lat: number
  lng: number
  heading?: number
  speed?: number
}

export interface NewMessageEvent extends ChatMessage {
  conversation_id: number
}

export interface RealtimeStatus {
  connected: boolean
  mode: 'echo' | 'polling' | 'offline'
}

/**
 * Abstraksi realtime.
 * - Mode 'echo'    : Laravel Echo + Reverb/Pusher (kalau env diaktifkan)
 * - Mode 'polling' : fallback, pakai REST periodik
 *
 * Nama channel WAJIB sama dengan Broadcast::channel() di Laravel.
 */
/**
 * State bersama (singleton).
 * Semua pemanggil `useRealtime()` memakai instance Echo/poller yang sama,
 * sehingga tidak ada koneksi ganda atau event yang terduplikasi.
 */
let echo: any = null
let poller: ReturnType<typeof setInterval> | null = null
let bound: string[] = []
const status = ref<RealtimeStatus['mode']>('offline')
const connected = ref(false)

export function useRealtime() {
  const config = useRuntimeConfig()
  const rideStore = useRideStore()
  const chatStore = useChatStore()
  const uiStore = useUiStore()

  async function connect() {
    if (!import.meta.client) return
    if (status.value === 'echo' || status.value === 'polling') return
    const rt = config.public.realtime as Record<string, any>
    const auth = useAuthStore()

    if (rt.enabled && rt.key) {
      try {
        const [{ default: Echo }, { default: Pusher }] = await Promise.all([
          import('laravel-echo'),
          import('pusher-js'),
        ])
        Pusher.logToConsole = false
        echo = new Echo({
          broadcaster: 'pusher',
          key: rt.key,
          wsHost: rt.wsHost,
          wsPort: Number(rt.wsPort),
          wssPort: Number(rt.wssPort),
          forceTLS: rt.forceTLS,
          enabledTransports: ['ws', 'wss'],
          cluster: rt.cluster,
        })
        if (auth.user) bindUser(auth.user.id)
        status.value = 'echo'
        connected.value = true
        return
      } catch (e) {
        console.warn('[realtime] Echo gagal diinisialisasi, fallback ke polling.', e)
      }
    }

    status.value = 'polling'
    connected.value = true
    startPolling()
  }

  function startPolling(intervalMs = 7000) {
    if (poller) return
    poller = setInterval(() => {
      if (rideStore.hasActiveRide || useAuthStore().isDriver) {
        void rideStore.fetchActive()
      }
      if (chatStore.activeId) void chatStore.fetchMessages(chatStore.activeId)
    }, intervalMs)
  }

  function stopPolling() {
    if (poller) clearInterval(poller)
    poller = null
  }

  function leave(channelsToLeave: string[]) {
    if (!echo) return
    for (const name of channelsToLeave) {
      try {
        echo.leave(name)
      } catch {
        /* ignore */
      }
    }
    bound = []
  }

  /** Dipanggil setelah login / saat user tersedia */
  function bindUser(userId: number) {
    if (!echo) {
      void authMeFallback(userId)
      return
    }
    leave(bound)
    bound = []

    const userChannel = echo.private(channels.user(userId))
    userChannel
      .listen('.ride.status', (payload: RideStatusEvent) => onRideStatus(payload))
      .listen('.chat.message', (payload: NewMessageEvent) => onMessage(payload))
      .listen('.notification.created', (payload: AppNotification) => onNotification(payload))
    bound.push(channels.user(userId))

    if (useAuthStore().isDriver) {
      const drv = echo.private(channels.driverLocation(userId))
      drv.listen('.driver.location', (p: DriverLocationEvent) => useDriverStore().applyLocation(p))
      bound.push(channels.driverLocation(userId))
    }
  }

  function bindRide(rideCode: string) {
    if (!echo) return
    const ch = echo.private(channels.ride(rideCode))
    ch.listen('.ride.location', (p: DriverLocationEvent) => onRideLocation(p))
        .listen('.ride.status', (p: RideStatusEvent) => onRideStatus(p))
    bound.push(channels.ride(rideCode))
  }

  function bindAdmin() {
    if (!echo) return
    echo.channel(channels.adminDashboard).listen('.stats.updated', () => refreshNuxtData())
    bound.push(channels.adminDashboard)
  }

  /* ---------- handlers ---------- */

  function onRideStatus(payload: RideStatusEvent) {
    const ok = rideStore.applyRealtimeStatus(payload.ride_id, payload.status)
    if (ok && payload.driver) {
      rideStore.activeRide!.driver = payload.driver
    }
    if (ok) {
      const labels: Record<string, string> = {
        driver_assigned: `${payload.driver?.user.name ?? 'Driver'} menuju lokasi Anda`,
        driver_arrived: 'Driver sudah sampai di lokasi',
        in_progress: 'Perjalanan dimulai',
        completed: 'Perjalanan selesai. Jangan lupa beri rating!',
        cancelled: 'Perjalanan dibatalkan',
        failed: 'Perjalanan gagal',
      }
      const text = labels[payload.status]
      if (text) {
        if (payload.status === 'completed') uiStore.success(text)
        else if (isRideCancelled(payload.status)) uiStore.error(text)
        else uiStore.info(text)
      }
    }
  }

  function onRideLocation(payload: DriverLocationEvent) {
    useDriverStore().applyRideLocation(payload)
  }

  function onMessage(payload: NewMessageEvent) {
    chatStore.pushIncoming(payload.conversation_id, payload)
  }

  function onNotification(payload: AppNotification) {
    useNotificationStore().push(payload)
    uiStore.toast(payload.title, payload.type === 'promo' ? 'info' : 'info', 5000)
  }

  async function authMeFallback(userId: number) {
    void userId
    // tanpa Echo: andalkan polling + saat halaman chat terbuka
  }

  function disconnect() {
    leave(bound)
    stopPolling()
    echo = null
    status.value = 'offline'
    connected.value = false
  }

  return {
    status: readonly(status),
    connected: readonly(connected),
    connect,
    disconnect,
    bindUser,
    bindRide,
    bindAdmin,
    sendLocation: (driverId: number, lat: number, lng: number, heading = 0) => {
      // Kirim lokasi via REST; channel hanya untuk broadcast ke customer
      void http.post('/drivers/me/location', { lat, lng, heading }).catch(() => undefined)
      void driverId
    },
  }
}
