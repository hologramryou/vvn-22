export const getUserRole = (): string =>
  localStorage.getItem('user_role') ?? 'viewer'

export const getUserId = (): number | null => {
  const raw = localStorage.getItem('user_id')
  if (!raw) return null
  const id = Number(raw)
  return Number.isFinite(id) ? id : null
}

export const getUserName = (): string =>
  localStorage.getItem('user_name') ?? ''

export const canScore = (): boolean =>
  ['admin', 'referee'].includes(getUserRole())

export const canSetup = (): boolean =>
  getUserRole() === 'admin'
