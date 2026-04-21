import api, { localApi } from '../lib/axios'
import type {
  TournamentStructure, BracketOut, MatchResultIn,
  TournamentSchedule, MedalTally, ClubMedalTally, MatchDetail, BracketTreeResponse,
  TournamentListItem, TournamentTemplateSummary, BracketExportData,
  QuyenScoringDetail, QuyenJudgePanel, QuyenDisplayDetail, RefereeCurrentAssignment,
  MatchScoreLog, ConsensusTurn, TournamentConfig, TournamentConfigUpdate,
} from '../types/tournament'

// ── List tournaments ───────────────────────────────────────────────────────

export const listTournaments = async (): Promise<TournamentListItem[]> => {
  const res = await api.get<TournamentListItem[]>('/tournaments')
  return res.data
}

export interface CreateTournamentPayload {
  name: string
  sport_icon?: string
  template_id?: number | null
}

export const createTournament = async (data: CreateTournamentPayload): Promise<TournamentListItem> => {
  const res = await api.post<TournamentListItem>('/tournaments', data)
  return res.data
}

export interface UpdateTournamentPayload {
  name?: string
  sport_icon?: string
  primary_color?: string | null
  gradient_primary?: string | null
}

export const updateTournament = async (tournamentId: number, data: UpdateTournamentPayload): Promise<TournamentListItem> => {
  const res = await api.patch<TournamentListItem>(`/tournaments/${tournamentId}`, data)
  return res.data
}

export const deleteTournament = async (tournamentId: number): Promise<{ deleted_tournament_id: number }> => {
  const res = await api.delete<{ deleted_tournament_id: number }>(`/tournaments/${tournamentId}`)
  return res.data
}

export const listTournamentTemplates = async (): Promise<TournamentTemplateSummary[]> => {
  const res = await api.get<TournamentTemplateSummary[]>('/tournament-templates')
  return res.data
}

export interface CreateTournamentTemplatePayload {
  name: string
  description?: string | null
  source_tournament_id: number
  copy_katas?: boolean
}

export const createTournamentTemplate = async (
  data: CreateTournamentTemplatePayload,
): Promise<TournamentTemplateSummary> => {
  const res = await api.post<TournamentTemplateSummary>('/tournament-templates', data)
  return res.data
}

// ── Structure ──────────────────────────────────────────────────────────────

export const getTournamentStructure = async (): Promise<TournamentStructure> => {
  const res = await api.get<TournamentStructure>('/tournaments/structure')
  return res.data
}

export const getTournamentStructureById = async (id: number): Promise<TournamentStructure> => {
  const res = await api.get<TournamentStructure>(`/tournaments/${id}/structure`)
  return res.data
}

// ── Per weight class bracket ───────────────────────────────────────────────

export const getBracket = async (wcId: number): Promise<BracketOut> => {
  const res = await api.get<BracketOut>(`/weight-classes/${wcId}/bracket`)
  return res.data
}

export const generateBracket = async (wcId: number): Promise<BracketOut> => {
  const res = await api.post<BracketOut>(`/weight-classes/${wcId}/generate`)
  return res.data
}

// ── Tournament-level generate + schedule + publish ─────────────────────────

export const generateAllMatches = async (tournamentId: number) => {
  const res = await api.post(`/tournaments/${tournamentId}/generate-matches`)
  return res.data
}

export const generateSchedule = async (tournamentId: number) => {
  const res = await api.post(`/tournaments/${tournamentId}/generate-schedule`)
  return res.data
}

export const getSchedule = async (tournamentId: number): Promise<TournamentSchedule> => {
  const res = await api.get<TournamentSchedule>(`/tournaments/${tournamentId}/schedule`)
  return res.data
}

// Live selector dùng localApi để lấy score thực tế tại sân
export const getScheduleLocal = async (tournamentId: number): Promise<TournamentSchedule> => {
  const res = await localApi.get<TournamentSchedule>(`/tournaments/${tournamentId}/schedule`)
  return res.data
}

export const getBracketExport = async (
  tournamentId: number,
  nodeId?: number | null,
): Promise<BracketExportData> => {
  const res = await api.get<BracketExportData>(`/tournaments/${tournamentId}/bracket-export`, {
    params: nodeId ? { node_id: nodeId } : undefined,
  })
  return res.data
}

export const publishTournament = async (tournamentId: number) => {
  const res = await api.patch(`/tournaments/${tournamentId}/publish`)
  return res.data
}

// ── Match actions ──────────────────────────────────────────────────────────

// ── Match detail: dùng localApi (sân) cho live screens; realtime updates đến từ WS ──
export const getMatchDetail = (matchId: number): Promise<MatchDetail> =>
  localApi.get<MatchDetail>(`/matches/${matchId}`).then(r => r.data)

// ── Match detail: dùng api (cloud) cho setup screens (trước khi sync vào local DB) ──
export const getMatchDetailCloud = (matchId: number): Promise<MatchDetail> =>
  api.get<MatchDetail>(`/matches/${matchId}`).then(r => r.data)

// ── Match setup: dùng api (cloud) vì là bước cấu hình trước trận ─────────
export const updateMatchJudgeSetup = async (
  matchId: number,
  payload: {
    judges: Array<{ judge_slot: number; user_id: number }>
  },
) => {
  const res = await api.patch(`/matches/${matchId}/setup`, payload)
  return res.data
}

// ── Live match actions: dùng localApi ─────────────────────────────────────
export const setMatchJudgeReady = async (
  matchId: number,
  judgeSlot: number,
  ready: boolean,
) => {
  const res = await localApi.patch(`/matches/${matchId}/judges/${judgeSlot}/ready`, { ready })
  return res.data
}

export const checkMatchExistsLocal = async (matchId: number): Promise<boolean> => {
  try {
    const res = await localApi.get<{ exists: boolean }>(`/sync/match/${matchId}/exists`)
    return res.data.exists
  } catch {
    return false
  }
}

export const startMatch = async (matchId: number): Promise<{ id: number; status: string; court: string }> => {
  const res = await api.patch<{ id: number; status: string; court: string }>(`/matches/${matchId}/start`)
  // Pull Railway state to local (no WS broadcast — avoids premature phase jump in ScoringPage)
  try { await localApi.post(`/sync/match/${matchId}`) } catch { /* best-effort */ }
  return res.data
}

export const beginMatch = async (matchId: number): Promise<{ id: number; status: string }> => {
  const res = await localApi.patch<{ id: number; status: string }>(`/matches/${matchId}/begin`)
  return res.data
}

export const resetMatch = async (matchId: number): Promise<{ id: number; status: string }> => {
  const res = await localApi.patch<{ id: number; status: string }>(`/matches/${matchId}/reset`)
  // Restore Railway's original duration config without syncing status/phase
  try {
    const cloud = await api.get<{ round_duration_seconds: number; break_duration_seconds: number }>(`/matches/${matchId}`)
    await localApi.patch(`/matches/${matchId}/config`, {
      round_duration_seconds: cloud.data.round_duration_seconds,
      break_duration_seconds: cloud.data.break_duration_seconds,
    })
  } catch { /* best-effort */ }
  return res.data
}

// Sync một thao tác lên Railway, sau khi thành công pull lại về local để 2 DB nhất quán.
const syncToRailwayWithRetry = (matchId: number, path: string, retries = 3, delayMs = 2000) => {
  const pullToLocal = () => {
    localApi.post(`/sync/match/${matchId}`).catch(() => {})
  }
  const attempt = (n: number) => {
    api.patch(path)
      .then(pullToLocal)
      .catch(() => {
        if (n > 1) setTimeout(() => attempt(n - 1), delayMs)
        else pullToLocal() // sau khi hết retry, vẫn pull local để đảm bảo nhất quán
      })
  }
  attempt(retries)
}

export const cancelMatch = async (matchId: number): Promise<{ id: number; status: string }> => {
  const res = await localApi.patch<{ id: number; status: string }>(`/matches/${matchId}/cancel`)
  syncToRailwayWithRetry(matchId, `/matches/${matchId}/cancel`)
  return res.data
}

export const setMatchHiep = async (matchId: number, hiep: number): Promise<{ id: number; current_hiep: number }> => {
  const res = await localApi.patch<{ id: number; current_hiep: number }>(`/matches/${matchId}/hiep`, { hiep })
  return res.data
}

export const updateMatchResult = async (
  matchId: number,
  body: MatchResultIn,
): Promise<{ id: number; winner: number; status: string }> => {
  const res = await localApi.post(`/matches/${matchId}/result`, body)
  return res.data
}

export const getMatchJudgePanel = async (matchId: number) => {
  const res = await localApi.get(`/matches/${matchId}/judge-panel`)
  return res.data
}

export const updateMatchJudgeScore = async (
  matchId: number,
  judgeSlot: number,
  body: { score1: number; score2: number },
) => {
  const res = await localApi.patch(`/matches/${matchId}/judges/${judgeSlot}/score`, body)
  return res.data
}

export const submitMatchJudgeScore = async (matchId: number, judgeSlot: number) => {
  const res = await localApi.patch(`/matches/${matchId}/judges/${judgeSlot}/submit`)
  return res.data
}

// ── Match state machine: dùng localApi ───────────────────────────────────

export const setMatchTimerActive = async (matchId: number, active: boolean) =>
  localApi.put(`/matches/${matchId}/timer-active`, { active }).then(r => r.data)

export const updateMatchLiveScore = async (matchId: number, body: { score1: number; score2: number; yellow_cards1?: number; yellow_cards2?: number }) => {
  const res = await localApi.patch(`/matches/${matchId}/live-score`, body)
  return res.data
}

export const endMatchRound = async (matchId: number, body: { score1: number; score2: number }) => {
  const res = await localApi.patch(`/matches/${matchId}/end-round`, body)
  return res.data
}

export const startMatchRound = async (matchId: number) => {
  const res = await localApi.patch(`/matches/${matchId}/start-round`)
  return res.data
}

export const drawMatchResult = async (matchId: number, body: { winner: 1 | 2 }) => {
  const res = await localApi.patch(`/matches/${matchId}/draw-result`, body)
  return res.data
}

export const confirmMatch = async (matchId: number) => {
  const res = await localApi.patch(`/matches/${matchId}/confirm`)
  return res.data
}

export const updateMatchConfig = async (
  matchId: number,
  body: { round_duration_seconds?: number; break_duration_seconds?: number },
) => {
  const res = await localApi.patch(`/matches/${matchId}/config`, body)
  return res.data
}

export const getMatchScoreLogs = async (matchId: number): Promise<MatchScoreLog[]> => {
  const res = await localApi.get<MatchScoreLog[]>(`/matches/${matchId}/score-logs`)
  return res.data
}

export const getMatchConsensusTurns = async (matchId: number): Promise<ConsensusTurn[]> => {
  const res = await localApi.get<ConsensusTurn[]>(`/matches/${matchId}/consensus-turns`)
  return res.data
}

export const addMatchScoreLog = async (
  matchId: number,
  body: {
    action: string
    side?: number | null
    delta?: number | null
    score1_after?: number | null
    score2_after?: number | null
    description?: string | null
  },
) => {
  const res = await localApi.post(`/matches/${matchId}/score-log`, body)
  return res.data
}

// ── Quyen slot actions ─────────────────────────────────────────────────────

export const startQuyenSlot = async (slotId: number) => {
  const res = await api.patch(`/quyen-slots/${slotId}/start`)
  return res.data
}

export const completeQuyenSlot = async (slotId: number) => {
  const res = await api.patch(`/quyen-slots/${slotId}/complete`)
  return res.data
}

export const getQuyenSlotScoring = async (slotId: number): Promise<QuyenScoringDetail> => {
  const res = await api.get<QuyenScoringDetail>(`/quyen-slots/${slotId}/scoring`)
  return res.data
}

export const getQuyenSlotDisplay = async (slotId: number): Promise<QuyenDisplayDetail> => {
  const res = await api.get<QuyenDisplayDetail>(`/quyen-slots/${slotId}/display`)
  return res.data
}

export const updateQuyenJudgeSetup = async (
  slotId: number,
  payload: {
    judges: Array<{ judge_slot: number; user_id: number }>
    performance_duration_seconds: number
  },
) => {
  const res = await api.patch(`/quyen-slots/${slotId}/setup`, payload)
  return res.data
}

export const getQuyenJudgePanel = async (slotId: number, judgeSlot: number): Promise<QuyenJudgePanel> => {
  const res = await api.get<QuyenJudgePanel>(`/quyen-slots/${slotId}/judges/${judgeSlot}`)
  return res.data
}

export const setQuyenJudgeReady = async (
  slotId: number,
  judgeSlot: number,
  ready: boolean,
) => {
  const res = await api.patch(`/quyen-slots/${slotId}/judges/${judgeSlot}/ready`, { ready })
  return res.data
}

export const submitQuyenJudgeScore = async (
  slotId: number,
  judgeSlot: number,
  body: { score: number },
) => {
  const res = await api.post(`/quyen-slots/${slotId}/judges/${judgeSlot}/score`, body)
  return res.data
}

export const unlockQuyenJudgeScore = async (slotId: number, judgeSlot: number) => {
  const res = await api.post(`/quyen-slots/${slotId}/judges/${judgeSlot}/unlock`)
  return res.data
}

export const resetQuyenSlotTimer = async (slotId: number, body?: { remaining_seconds?: number }) => {
  const res = await api.patch(`/quyen-slots/${slotId}/reset-timer`, body ?? {})
  return res.data
}

export const resumeQuyenSlot = async (slotId: number) => {
  const res = await api.patch(`/quyen-slots/${slotId}/resume`)
  return res.data
}

export const disqualifyQuyenSlot = async (slotId: number) => {
  const res = await api.patch(`/quyen-slots/${slotId}/disqualify`)
  return res.data
}

export const resetQuyenSlotToChecking = async (slotId: number) => {
  const res = await api.patch(`/quyen-slots/${slotId}/reset-to-checking`)
  return res.data
}

export const getRefereeCurrentAssignment = async (): Promise<RefereeCurrentAssignment | null> => {
  const res = await api.get<RefereeCurrentAssignment | null>('/referee/current-assignment')
  return res.data
}

// ── Schedule manual edit (drag & drop reorder + court change) ─────────────

export interface ScheduleItemUpdate {
  id: number
  schedule_order: number
  court?: string | null
}

export interface UpdateSchedulePayload {
  bracket_matches?: ScheduleItemUpdate[]
  quyen_slots?: ScheduleItemUpdate[]
}

export const updateSchedule = async (
  tournamentId: number,
  payload: UpdateSchedulePayload,
): Promise<{ updated_bracket: number; updated_quyen: number }> => {
  const res = await api.patch(`/tournaments/${tournamentId}/update-schedule`, payload)
  return res.data
}

// ── Tournament config ──────────────────────────────────────────────────────

export const getTournamentConfig = async (tournamentId: number): Promise<TournamentConfig> => {
  const res = await api.get<TournamentConfig>(`/tournaments/${tournamentId}/config`)
  return res.data
}

export const updateTournamentConfig = async (
  tournamentId: number,
  data: TournamentConfigUpdate,
): Promise<TournamentConfig> => {
  const res = await api.patch<TournamentConfig>(`/tournaments/${tournamentId}/config`, data)
  return res.data
}

// ── Admin reset ────────────────────────────────────────────────────────────

export const resetTournament = async (tournamentId: number) => {
  const res = await api.post(`/tournaments/${tournamentId}/reset`)
  return res.data
}

// ── Medal tally ────────────────────────────────────────────────────────────

export const getMedals = async (tournamentId: number): Promise<MedalTally> => {
  const res = await api.get<MedalTally>(`/tournaments/${tournamentId}/medals`)
  return res.data
}

export const getMedalsByClub = async (tournamentId: number): Promise<ClubMedalTally> => {
  const res = await api.get<ClubMedalTally>(`/tournaments/${tournamentId}/medals/by-club`)
  return res.data
}

export interface AthleteStatsByClub {
  total: number
  by_club: { club_name: string; count: number }[]
}

export const getAthleteStats = async (tournamentId: number): Promise<AthleteStatsByClub> => {
  const res = await api.get<AthleteStatsByClub>(`/tournaments/${tournamentId}/athlete-stats`)
  return res.data
}

// ── Bracket tree (dynamic tournament bracket display) ────────────────────────

export const getBracketTree = async (tournamentId: number): Promise<BracketTreeResponse> => {
  const res = await api.get<BracketTreeResponse>(`/api/tournaments/${tournamentId}/bracket-tree`)
  return res.data
}
