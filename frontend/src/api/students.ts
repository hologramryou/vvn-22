import api from '../lib/axios'
import type { StudentListResponse, Club, StudentDetail, StudentCardData } from '../types/student'

export const fetchStudents = async (params: Record<string, string | number>) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))
  const { data } = await api.get<StudentListResponse>('/students/', { params: clean })
  return data
}

export const fetchClubs = async (tournamentId?: number): Promise<Club[]> => {
  const params = tournamentId ? { tournament_id: tournamentId } : {}
  const { data } = await api.get<Club[]>('/students/clubs', { params })
  return data
}

export const deleteStudent = async (id: number) => {
  await api.delete(`/students/${id}`)
}

export const fetchStudentDetail = async (id: number, tournamentId?: number): Promise<StudentDetail> => {
  const params = tournamentId ? { tournament_id: tournamentId } : {}
  const { data } = await api.get<StudentDetail>(`/students/${id}`, { params })
  return data
}

export const createStudent = async (body: Record<string, unknown>) => {
  const { data } = await api.post('/students/', body)
  return data
}

export const updateStudent = async (id: number, body: Record<string, unknown>) => {
  const { data } = await api.put(`/students/${id}`, body)
  return data
}

export const importStudents = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/students/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const patchWeightVerified = async (id: number, weight_verified: boolean) => {
  const { data } = await api.patch(`/students/${id}/weight-verified`, { weight_verified })
  return data
}

export const uploadStudentAvatar = async (id: number, file: File): Promise<{ avatar_url: string }> => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post(`/students/${id}/avatar`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const fetchExportCardsData = async (params: { ids?: number[]; club_id?: number; tournament_id?: number }): Promise<StudentCardData[]> => {
  const query: Record<string, unknown> = {}
  if (params.ids && params.ids.length > 0) query['ids'] = params.ids
  if (params.club_id) query['club_id'] = params.club_id
  if (params.tournament_id) query['tournament_id'] = params.tournament_id
  const { data } = await api.get<StudentCardData[]>('/students/export-cards-data', { params: query, paramsSerializer: p => {
    const s = new URLSearchParams()
    if (p.ids) (p.ids as number[]).forEach(id => s.append('ids', String(id)))
    if (p.club_id) s.append('club_id', String(p.club_id))
    if (p.tournament_id) s.append('tournament_id', String(p.tournament_id))
    return s.toString()
  }})
  return data
}

export const bulkDeleteStudents = async (ids: number[]) => {
  const { data } = await api.delete('/students/bulk', { data: ids })
  return data
}

export const loginApi = async (username: string, password: string) => {
  const { data } = await api.post('/auth/login', { username, password })
  return data
}
