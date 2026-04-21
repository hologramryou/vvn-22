const CLOUD_API = (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:8001'
const LOCAL_API = (import.meta.env.VITE_LOCAL_API_URL as string) ?? 'http://localhost:8001'
const LOCAL_WS = (import.meta.env.VITE_LOCAL_WS_URL as string) ?? 'ws://localhost:8001'
const CLOUD_WS = (import.meta.env.VITE_WS_URL as string) ?? 'ws://localhost:8001'

const LIVE_ROUTE_PATTERNS = [
  /^\/matches\/\d+\/score/,
  /^\/matches\/\d+\/judge-panel/,
  /^\/display/,
]

export function isLiveRoute(pathname: string): boolean {
  return LIVE_ROUTE_PATTERNS.some((p) => p.test(pathname))
}

export function getApiBaseUrl(): string {
  return CLOUD_API  // business APIs always go to cloud
}

export function getLocalApiUrl(): string {
  return LOCAL_API
}

export function getWsUrl(isLive: boolean): string {
  return isLive ? LOCAL_WS : CLOUD_WS
}
