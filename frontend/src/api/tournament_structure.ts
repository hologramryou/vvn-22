import api from '../lib/axios'
import type {
  TournamentStructureNode,
  TournamentKata,
  ContestTypeItem,
  StudentRegistration,
  NodesResponse,
  KatasResponse,
  TeamKataRegistrationResponse,
  TeamKataMembersResponse,
  NodeStudentsResponse,
  BracketTreeResponse,
} from '../types/tournament'

// ── Node endpoints ─────────────────────────────────────────────────────────

export const getNodes = async (
  tournamentId: number,
  format: 'tree' | 'flat' = 'flat',
): Promise<NodesResponse> => {
  const res = await api.get<NodesResponse>(
    `/api/tournaments/${tournamentId}/weight-class-nodes`,
    { params: { format } },
  )
  return res.data
}

export interface CreateNodePayload {
  parent_id: number | null
  name:      string
  node_type?: 'group' | 'weight_class'
}

export const createNode = async (
  tournamentId: number,
  data: CreateNodePayload,
): Promise<TournamentStructureNode> => {
  const res = await api.post<TournamentStructureNode>(
    `/api/tournaments/${tournamentId}/weight-class-nodes`,
    data,
  )
  return res.data
}

export const updateNode = async (
  tournamentId: number,
  nodeId: number,
  data: { name: string },
): Promise<TournamentStructureNode> => {
  const res = await api.patch<TournamentStructureNode>(
    `/api/tournaments/${tournamentId}/weight-class-nodes/${nodeId}`,
    data,
  )
  return res.data
}

export interface DeleteNodePayload {
  move_to_node_id?: number | null
}

export interface DeleteNodeResult {
  deleted_node_id: number
  deleted_count:   number
  moved_students:  number
}

export const deleteNode = async (
  tournamentId: number,
  nodeId: number,
  data: DeleteNodePayload,
): Promise<DeleteNodeResult> => {
  const res = await api.delete<DeleteNodeResult>(
    `/api/tournaments/${tournamentId}/weight-class-nodes/${nodeId}`,
    { data },
  )
  return res.data
}

export interface ReorderNodeItem {
  node_id:    number
  sort_order: number
}

export interface ReorderNodesPayload {
  parent_id: number | null
  nodes:     ReorderNodeItem[]
}

export const reorderNodes = async (
  tournamentId: number,
  data: ReorderNodesPayload,
): Promise<{ updated_count: number; nodes: TournamentStructureNode[] }> => {
  const res = await api.post(
    `/api/tournaments/${tournamentId}/weight-class-nodes/reorder`,
    data,
  )
  return res.data
}

export interface CopyStructurePayload {
  source_tournament_id: number
  copy_katas:           boolean
}

export interface CopyStructureResult {
  copied_nodes: number
  copied_katas: number
  tree:         TournamentStructureNode[]
}

export const copyStructure = async (
  tournamentId: number,
  data: CopyStructurePayload,
): Promise<CopyStructureResult> => {
  const res = await api.post<CopyStructureResult>(
    `/api/tournaments/${tournamentId}/weight-class-nodes/copy`,
    data,
  )
  return res.data
}

export const getNodeStudents = async (
  tournamentId: number,
  nodeId: number,
  includeDescendants = true,
): Promise<NodeStudentsResponse> => {
  const res = await api.get<NodeStudentsResponse>(
    `/api/tournaments/${tournamentId}/weight-class-nodes/${nodeId}/students`,
    { params: { include_descendants: includeDescendants } },
  )
  return res.data
}

// ── Participant endpoints ──────────────────────────────────────────────────

export interface RegisterParticipantPayload {
  node_id: number | null
  sparring: boolean
  sparring_weight_id: number | null
  kata: boolean
  kata_ids: number[]
}

export const registerParticipant = async (
  tournamentId: number,
  studentId: number,
  data: RegisterParticipantPayload,
): Promise<StudentRegistration> => {
  const res = await api.post<StudentRegistration>(
    `/api/tournaments/${tournamentId}/participants/${studentId}/register`,
    data,
  )
  return res.data
}

export const reassignNode = async (
  tournamentId: number,
  studentId: number,
  data: { new_node_id: number },
): Promise<StudentRegistration> => {
  const res = await api.post<StudentRegistration>(
    `/api/tournaments/${tournamentId}/participants/${studentId}/reassign`,
    data,
  )
  return res.data
}

export interface UpdateContestTypesPayload {
  contest_types: ContestTypeItem[]
}

export const updateContestTypes = async (
  tournamentId: number,
  studentId: number,
  data: UpdateContestTypesPayload,
): Promise<StudentRegistration> => {
  const res = await api.patch<StudentRegistration>(
    `/api/tournaments/${tournamentId}/participants/${studentId}/contest-types`,
    data,
  )
  return res.data
}

export const getParticipantRegistration = async (
  tournamentId: number,
  studentId: number,
): Promise<StudentRegistration> => {
  const res = await api.get<StudentRegistration>(
    `/api/tournaments/${tournamentId}/participants/${studentId}`,
  )
  return res.data
}

// ── Kata endpoints ─────────────────────────────────────────────────────────

export const listKatas = async (tournamentId: number): Promise<KatasResponse> => {
  const res = await api.get<KatasResponse>(`/api/tournaments/${tournamentId}/katas`)
  return res.data
}

export interface CreateKataPayload {
  division:    'individual' | 'team'
  name:        string
  description?: string | null
  team_size?:  number
}

export const createKata = async (
  tournamentId: number,
  data: CreateKataPayload,
): Promise<TournamentKata> => {
  const res = await api.post<TournamentKata>(`/api/tournaments/${tournamentId}/katas`, data)
  return res.data
}

export interface UpdateKataPayload {
  division?:     'individual' | 'team'
  name?:         string
  description?:  string | null
  team_size?:    number | null
  min_team_size?: number | null
}

export const updateKata = async (
  tournamentId: number,
  kataId: number,
  data: UpdateKataPayload,
): Promise<TournamentKata> => {
  const res = await api.patch<TournamentKata>(
    `/api/tournaments/${tournamentId}/katas/${kataId}`,
    data,
  )
  return res.data
}

export interface DeleteKataResult {
  deleted_kata_id: number
  kata_name:       string
}

export const deleteKata = async (
  tournamentId: number,
  kataId: number,
): Promise<DeleteKataResult> => {
  const res = await api.delete<DeleteKataResult>(
    `/api/tournaments/${tournamentId}/katas/${kataId}`,
  )
  return res.data
}

export interface ReorderKataItem {
  kata_id:    number
  sort_order: number
}

export const reorderKatas = async (
  tournamentId: number,
  katas: ReorderKataItem[],
): Promise<{ updated_count: number; katas: TournamentKata[] }> => {
  const res = await api.post(`/api/tournaments/${tournamentId}/katas/reorder`, { katas })
  return res.data
}

// ── Bracket tree (dynamic tournament bracket display) ────────────────────────

export const getBracketTree = async (tournamentId: number): Promise<BracketTreeResponse> => {
  const res = await api.get<BracketTreeResponse>(`/api/tournaments/${tournamentId}/bracket-tree`)
  return res.data
}

export const getTeamKataRegistrations = async (
  tournamentId: number,
  clubId: number,
): Promise<TeamKataRegistrationResponse> => {
  const res = await api.get<TeamKataRegistrationResponse>(
    `/api/tournaments/${tournamentId}/clubs/${clubId}/team-kata-registrations`,
  )
  return res.data
}

export const replaceTeamKataRegistrations = async (
  tournamentId: number,
  clubId: number,
  items: { node_id: number; kata_id: number }[],
): Promise<TeamKataRegistrationResponse> => {
  const res = await api.put<TeamKataRegistrationResponse>(
    `/api/tournaments/${tournamentId}/clubs/${clubId}/team-kata-registrations`,
    { items },
  )
  return res.data
}

export const getTeamKataMembers = async (
  tournamentId: number,
  clubId: number,
  nodeId: number,
  kataId: number,
): Promise<TeamKataMembersResponse> => {
  const res = await api.get<TeamKataMembersResponse>(
    `/api/tournaments/${tournamentId}/clubs/${clubId}/team-kata-members`,
    { params: { node_id: nodeId, kata_id: kataId } },
  )
  return res.data
}

export const replaceTeamKataMembers = async (
  tournamentId: number,
  clubId: number,
  nodeId: number,
  kataId: number,
  studentIds: number[],
): Promise<TeamKataMembersResponse> => {
  const res = await api.put<TeamKataMembersResponse>(
    `/api/tournaments/${tournamentId}/clubs/${clubId}/team-kata-members`,
    { student_ids: studentIds },
    { params: { node_id: nodeId, kata_id: kataId } },
  )
  return res.data
}
