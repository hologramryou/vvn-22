import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchAdminClubs,
  createClub,
  updateClub,
  deleteClub,
  fetchProvinces,
} from '../api/clubs'

export const useAdminClubs = (params: Record<string, string | number>) =>
  useQuery({
    queryKey: ['admin-clubs', params],
    queryFn: () => fetchAdminClubs(params),
  })

export const useProvinces = () =>
  useQuery({
    queryKey: ['provinces'],
    queryFn: fetchProvinces,
    staleTime: 10 * 60 * 1000, // provinces rarely change
  })

export const useCreateClub = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => createClub(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-clubs'] }),
  })
}

export const useUpdateClub = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      updateClub(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-clubs'] }),
  })
}

export const useDeleteClub = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteClub(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-clubs'] }),
  })
}
