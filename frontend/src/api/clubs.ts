import api from '../lib/axios'
import type { Club, ClubListResponse, Province } from '../types/club'

export const fetchAdminClubs = async (
  params: Record<string, string | number>,
): Promise<ClubListResponse> => {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined),
  )
  const { data } = await api.get<ClubListResponse>('/admin/clubs', { params: clean })
  return data
}

export const createClub = async (body: Record<string, unknown>): Promise<Club> => {
  const { data } = await api.post<Club>('/admin/clubs', body)
  return data
}

export const updateClub = async (id: number, body: Record<string, unknown>): Promise<Club> => {
  const { data } = await api.put<Club>(`/admin/clubs/${id}`, body)
  return data
}

export const deleteClub = async (id: number): Promise<void> => {
  await api.delete(`/admin/clubs/${id}`)
}

export const fetchProvinces = async (): Promise<Province[]> => {
  const { data } = await api.get<Province[]>('/admin/provinces')
  return data
}
