import api from '../lib/axios'

export interface UserOut {
  id: number
  username: string
  full_name: string
  email: string
  phone?: string | null
  role: string
  club_id?: number | null
  club_name?: string | null
  tournament_ids: number[]
  is_active: boolean
  last_login_at?: string | null
  created_at?: string | null
}

export interface ClubOption {
  id: number
  name: string
  code: string
}

export interface UserCreateIn {
  username: string
  password: string
  full_name: string
  email: string
  phone?: string
  role: string
  club_id?: number | null
  tournament_ids?: number[]
  is_active?: boolean
}

export interface UserUpdateIn {
  full_name?: string
  email?: string
  phone?: string
  role?: string
  club_id?: number | null
  tournament_ids?: number[]
  is_active?: boolean
  password?: string
}

export const getUsers = async (): Promise<UserOut[]> => {
  const { data } = await api.get('/users')
  return data
}

export const createUser = async (body: UserCreateIn): Promise<UserOut> => {
  const { data } = await api.post('/users', body)
  return data
}

export const updateUser = async (id: number, body: UserUpdateIn): Promise<UserOut> => {
  const { data } = await api.put(`/users/${id}`, body)
  return data
}

export const deleteUser = async (id: number): Promise<void> => {
  await api.delete(`/users/${id}`)
}

export const getClubsForSelect = async (): Promise<ClubOption[]> => {
  const { data } = await api.get('/users/clubs/all')
  return data
}
