import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as structureAPI from '../api/tournament_structure'
import type { TournamentStructureNode } from '../types/tournament'

// ── Query key factory ──────────────────────────────────────────────────────

const keys = {
  nodes:        (tid: number) => ['tournament-structure', 'nodes', tid] as const,
  katas:        (tid: number) => ['tournament-structure', 'katas', tid] as const,
  teamKataRegistration: (tid: number, clubId: number) =>
    ['tournament-structure', 'team-kata-registration', tid, clubId] as const,
  teamKataMembers: (tid: number, clubId: number, nodeId: number, kataId: number) =>
    ['tournament-structure', 'team-kata-members', tid, clubId, nodeId, kataId] as const,
  registration: (tid: number, sid: number) =>
    ['tournament-structure', 'registration', tid, sid] as const,
}

// ── Client-side tree builder ───────────────────────────────────────────────

export function buildTree(flatNodes: TournamentStructureNode[]): TournamentStructureNode[] {
  if (!flatNodes.length) return []

  const nodeMap = new Map<number, TournamentStructureNode>()
  const roots: TournamentStructureNode[] = []

  // Clone each node and init empty children
  for (const n of flatNodes) {
    nodeMap.set(n.id, { ...n, children: [] })
  }

  for (const n of flatNodes) {
    const node = nodeMap.get(n.id)!
    if (n.parent_id === null) {
      roots.push(node)
    } else {
      const parent = nodeMap.get(n.parent_id)
      if (parent) {
        parent.children.push(node)
      }
    }
  }

  // Sort by sort_order recursively
  const sortChildren = (nodes: TournamentStructureNode[]): void => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    nodes.forEach(n => sortChildren(n.children))
  }
  sortChildren(roots)

  return roots
}

// ── Node hooks ─────────────────────────────────────────────────────────────

export function useStructureNodes(tournamentId: number) {
  return useQuery({
    queryKey: keys.nodes(tournamentId),
    queryFn:  () => structureAPI.getNodes(tournamentId, 'flat'),
    enabled:  tournamentId > 0,
    select:   data => ({
      ...data,
      treeData: buildTree(data.nodes),
    }),
  })
}

export function useCreateNode(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: structureAPI.CreateNodePayload) =>
      structureAPI.createNode(tournamentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
    },
  })
}

export function useUpdateNode(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, name }: { nodeId: number; name: string }) =>
      structureAPI.updateNode(tournamentId, nodeId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
    },
  })
}

export function useDeleteNode(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ nodeId, moveToNodeId }: { nodeId: number; moveToNodeId?: number | null }) =>
      structureAPI.deleteNode(tournamentId, nodeId, { move_to_node_id: moveToNodeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
    },
  })
}

export function useReorderNodes(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: structureAPI.ReorderNodesPayload) =>
      structureAPI.reorderNodes(tournamentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
    },
  })
}

export function useCopyStructure(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: structureAPI.CopyStructurePayload) =>
      structureAPI.copyStructure(tournamentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
      queryClient.invalidateQueries({ queryKey: keys.katas(tournamentId) })
    },
  })
}

// ── Kata hooks ─────────────────────────────────────────────────────────────

export function useKatas(tournamentId: number) {
  return useQuery({
    queryKey: keys.katas(tournamentId),
    queryFn:  () => structureAPI.listKatas(tournamentId),
    enabled:  tournamentId > 0,
  })
}

export function useCreateKata(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: structureAPI.CreateKataPayload) =>
      structureAPI.createKata(tournamentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.katas(tournamentId) })
    },
  })
}

export function useUpdateKata(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kataId, data }: { kataId: number; data: structureAPI.UpdateKataPayload }) =>
      structureAPI.updateKata(tournamentId, kataId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.katas(tournamentId) })
    },
  })
}

export function useDeleteKata(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (kataId: number) => structureAPI.deleteKata(tournamentId, kataId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.katas(tournamentId) })
    },
  })
}

export function useReorderKatas(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (katas: structureAPI.ReorderKataItem[]) =>
      structureAPI.reorderKatas(tournamentId, katas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.katas(tournamentId) })
    },
  })
}

// ── Participant registration hooks ─────────────────────────────────────────

export function useParticipantRegistration(tournamentId: number, studentId: number) {
  return useQuery({
    queryKey: keys.registration(tournamentId, studentId),
    queryFn:  () => structureAPI.getParticipantRegistration(tournamentId, studentId),
    enabled:  tournamentId > 0 && studentId > 0,
    retry:    (failureCount, error) => {
      // Don't retry 404 (participant not registered)
      const status = (error as { response?: { status: number } }).response?.status
      if (status === 404) return false
      return failureCount < 2
    },
  })
}

export function useRegisterParticipant(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      studentId,
      data,
    }: {
      studentId: number
      data: structureAPI.RegisterParticipantPayload
    }) => structureAPI.registerParticipant(tournamentId, studentId, data),
    onSuccess: (_, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: keys.registration(tournamentId, studentId) })
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
    },
  })
}

export function useReassignNode(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ studentId, newNodeId }: { studentId: number; newNodeId: number }) =>
      structureAPI.reassignNode(tournamentId, studentId, { new_node_id: newNodeId }),
    onSuccess: (_, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: keys.registration(tournamentId, studentId) })
      queryClient.invalidateQueries({ queryKey: keys.nodes(tournamentId) })
    },
  })
}

export function useUpdateContestTypes(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      studentId,
      data,
    }: {
      studentId: number
      data: structureAPI.UpdateContestTypesPayload
    }) => structureAPI.updateContestTypes(tournamentId, studentId, data),
    onSuccess: (_, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: keys.registration(tournamentId, studentId) })
    },
  })
}

export function useTeamKataRegistration(tournamentId: number, clubId: number | null) {
  return useQuery({
    queryKey: clubId ? keys.teamKataRegistration(tournamentId, clubId) : ['tournament-structure', 'team-kata-registration', tournamentId, 'none'],
    queryFn: () => structureAPI.getTeamKataRegistrations(tournamentId, clubId!),
    enabled: tournamentId > 0 && !!clubId,
  })
}

export function useReplaceTeamKataRegistration(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clubId, items }: { clubId: number; items: { node_id: number; kata_id: number }[] }) =>
      structureAPI.replaceTeamKataRegistrations(tournamentId, clubId, items),
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: keys.teamKataRegistration(tournamentId, clubId) })
    },
  })
}

export function useTeamKataMembers(
  tournamentId: number,
  clubId: number | null,
  nodeId: number | null,
  kataId: number | null,
) {
  return useQuery({
    queryKey: clubId && nodeId && kataId
      ? keys.teamKataMembers(tournamentId, clubId, nodeId, kataId)
      : ['tournament-structure', 'team-kata-members', 'disabled'],
    queryFn: () => structureAPI.getTeamKataMembers(tournamentId, clubId!, nodeId!, kataId!),
    enabled: tournamentId > 0 && !!clubId && !!nodeId && !!kataId,
  })
}

export function useReplaceTeamKataMembers(tournamentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      clubId, nodeId, kataId, studentIds,
    }: { clubId: number; nodeId: number; kataId: number; studentIds: number[] }) =>
      structureAPI.replaceTeamKataMembers(tournamentId, clubId, nodeId, kataId, studentIds),
    onSuccess: (_, { clubId, nodeId, kataId }) => {
      queryClient.invalidateQueries({
        queryKey: keys.teamKataMembers(tournamentId, clubId, nodeId, kataId),
      })
    },
  })
}
