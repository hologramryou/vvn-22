import axios from 'axios'

// Track in-flight Railway PATCH/POST requests so UI can show a global loading overlay
let _railwayPendingCount = 0
const _listeners = new Set<(pending: boolean) => void>()

export const subscribeRailwayPending = (cb: (pending: boolean) => void) => {
  _listeners.add(cb)
  return () => _listeners.delete(cb)
}

const _notify = () => {
  const pending = _railwayPendingCount > 0
  _listeners.forEach(cb => cb(pending))
}

const env = import.meta.env as ImportMetaEnv & Record<string, string | undefined>
const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

const apiBaseUrl =
  env.VITE_API_URL ||
  env.REACT_APP_API_URL ||
  (isLocalHost ? env.REACT_APP_API_INTERNAL_URL : undefined) ||
  (isLocalHost ? 'http://localhost:8001' : '')

const localApiBaseUrl =
  env.VITE_LOCAL_API_URL ||
  (isLocalHost ? 'http://localhost:8001' : apiBaseUrl)

/** true chỉ khi VITE_LOCAL_API_URL được set (tức là đang chạy local, không phải Railway) */
export const isLocalMode = Boolean(env.VITE_LOCAL_API_URL)

function makeInstance(baseURL: string, trackPending = false) {
  const instance = axios.create({ baseURL })
  instance.interceptors.request.use(cfg => {
    const token = localStorage.getItem('access_token')
    if (token) cfg.headers.Authorization = `Bearer ${token}`
    if (trackPending && cfg.method && ['patch', 'post', 'put', 'delete'].includes(cfg.method)) {
      _railwayPendingCount++
      _notify()
    }
    return cfg
  })
  instance.interceptors.response.use(
    res => {
      if (trackPending && res.config.method && ['patch', 'post', 'put', 'delete'].includes(res.config.method)) {
        _railwayPendingCount = Math.max(0, _railwayPendingCount - 1)
        _notify()
      }
      return res
    },
    err => {
      if (trackPending && err.config?.method && ['patch', 'post', 'put', 'delete'].includes(err.config.method)) {
        _railwayPendingCount = Math.max(0, _railwayPendingCount - 1)
        _notify()
      }
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
      return Promise.reject(err)
    },
  )
  return instance
}

const api = makeInstance(apiBaseUrl, true)

/** Axios instance trỏ vào local server tại sân (dùng cho màn live) */
export const localApi = makeInstance(localApiBaseUrl)

export default api
