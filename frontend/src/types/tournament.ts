export interface ParticipantInfo {
  student_id: number
  full_name: string
  gender: string
  weight_class: number | null
}

export interface WeightClassItem {
  id: number
  weight_class_name: string
  gender: string  // 'M' | 'F'
  total_players: number
  bracket_status: 'NOT_GENERATED' | 'GENERATING' | 'GENERATED'
  players: string[] | null
  participants: ParticipantInfo[]
}

export interface AgeTypeItem {
  code: string
  description: string
  weight_classes: WeightClassItem[]
}

export interface CategoryItem {
  category: string
  age_types: AgeTypeItem[]
}

export interface TournamentStructure {
  tournament_id: number
  tournament_name: string
  tournament_status: string  // 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED'
  categories: CategoryItem[]
}

export interface TournamentListItem {
  id: number
  name: string
  sport_icon?: string | null
  status: string
  created_at: string
  structure_mode: 'legacy' | 'dynamic'
  primary_color?: string | null
  gradient_primary?: string | null
}

export interface TournamentConfig {
  default_round_duration_seconds: number
  default_break_duration_seconds: number
  default_performance_duration_seconds: number
  consensus_window_secs: number
  consensus_min_votes: number
}

export interface TournamentConfigUpdate {
  default_round_duration_seconds?: number | null
  default_break_duration_seconds?: number | null
  default_performance_duration_seconds?: number | null
  consensus_window_secs?: number | null
  consensus_min_votes?: number | null
}

export interface TournamentTemplateSummary {
  id: number
  name: string
  description: string | null
  structure_mode: 'legacy' | 'dynamic'
  source_tournament_id: number | null
  node_count: number
  kata_count: number
  created_at: string
  updated_at: string
}

export interface BracketMatch {
  id: number
  round: number
  match_number: number
  match_code: string | null
  schedule_order?: number | null
  player1_name: string | null
  player2_name: string | null
  score1: number | null
  score2: number | null
  winner: number | null   // 1 or 2
  status: 'pending' | 'ready' | 'ongoing' | 'completed'
  is_bye: boolean
  next_match_id: number | null
}

export interface BracketOut {
  weight_class_id: number
  weight_class_name: string
  bracket_status: string
  matches: BracketMatch[]
}

export interface BracketExportPath {
  node_id: number
  node_path: string
  tree_path: string
  path_segments: string[]
  weight_class_id: number
  weight_class_name: string
  gender: string
  total_players: number
  bracket_status: 'NOT_GENERATED' | 'GENERATING' | 'GENERATED'
  players: string[]
  matches: BracketMatch[]
}

export interface BracketExportData {
  tournament_id: number
  tournament_name: string
  tournament_status: string
  scope: 'single' | 'all'
  total_paths: number
  paths: BracketExportPath[]
}

export interface MatchResultIn {
  winner: number
  score1: number
  score2: number
}

// ── Schedule types ─────────────────────────────────────────────────────────

export interface QuyenSlot {
  id: number
  tournament_id: number
  weight_class_id: number | null
  weight_class_name: string
  node_id: number | null
  node_path: string | null
  representative_type: 'student' | 'club'
  player_name: string
  player_club: string | null
  club_id: number | null
  kata_id: number | null
  content_name: string
  court: string | null      // 'A' | 'B'
  schedule_order: number | null
  status: 'pending' | 'ready' | 'checking' | 'ongoing' | 'scoring' | 'completed'
  performance_duration_seconds: number
  started_at: string | null
  scoring_started_at: string | null
  scored_at: string | null
  finished_at: string | null
  confirmed_at: string | null
  official_score: number | null
  total_judge_score: number | null
  highest_judge_score: number | null
  lowest_judge_score: number | null
  is_disqualified: boolean
  assigned_judges_count: number
  ready_judges_count: number
  submitted_judges_count: number
}

export interface ScheduleBracketMatch {
  id: number
  weight_class_id: number
  weight_class_name: string
  node_path: string | null
  gender: string
  category: string
  age_type_code: string
  match_code: string | null
  round: number
  round_label: string
  match_number: number
  player1_name: string | null
  player2_name: string | null
  player1_club: string | null
  player2_club: string | null
  score1: number | null
  score2: number | null
  winner: number | null
  winner_name: string | null
  court: string | null
  schedule_order: number | null
  status: 'pending' | 'ready' | 'ongoing' | 'completed'
  is_bye: boolean
  next_match_id: number | null
  next_match_code: string | null
  started_at: string | null
  finished_at: string | null
  assigned_judges_count: number
  ready_judges_count: number
}

export interface ScheduleSummary {
  quyen_count: number
  doi_khang_count: number
  ready_count: number
  ongoing_count: number
  scoring_count: number
  scored_count: number
  completed_count: number
  pending_count: number
}

export interface TournamentSchedule {
  tournament_id: number
  tournament_name: string
  tournament_status: string
  summary: ScheduleSummary
  quyen_slots: QuyenSlot[]
  bracket_matches: ScheduleBracketMatch[]
}

// ── Medal tally ────────────────────────────────────────────────────────────

export interface WeightClassMedal {
  weight_class_id: number
  weight_class_name: string
  gender: string
  tree_path: string
  status: 'completed' | 'in_progress'
  gold: string | null
  gold_club: string | null
  silver: string | null
  silver_club: string | null
  bronze: string[]
  bronze_clubs: string[]
}

export interface QuyenMedalGroup {
  node_id: number | null
  node_path: string | null
  content_name: string
  kata_id: number | null
  status: 'completed' | 'in_progress'
  gold: string | null
  gold_club: string | null
  gold_club_id: number | null
  silver: string | null
  silver_club: string | null
  silver_club_id: number | null
  bronze: string[]
  bronze_clubs: string[]
  bronze_club_ids: (number | null)[]
}

export interface MedalTally {
  tournament_id: number
  tournament_name: string
  weight_class_medals: WeightClassMedal[]
  quyen_medals: QuyenMedalGroup[]
}

export interface ClubMedalRank {
  rank: number
  club_id: number
  club_name: string
  gold: number
  silver: number
  bronze: number
  total: number
  athlete_count: number
}

export interface ClubMedalTally {
  tournament_id: number
  tournament_name: string
  rankings: ClubMedalRank[]
}

export interface QuyenJudgeScore {
  judge_slot: number
  assigned_user_id: number | null
  assigned_user_name: string | null
  is_ready: boolean
  ready_at: string | null
  score: number | null
  submitted_at: string | null
}

export interface QuyenRankingItem {
  slot_id: number
  rank: number
  player_name: string
  player_club: string | null
  official_score: number
  total_judge_score: number
  highest_judge_score: number
  lowest_judge_score: number
  medal: 'gold' | 'silver' | 'bronze' | null
}

export interface QuyenRankingGroup {
  node_id: number | null
  node_path: string | null
  content_name: string
  status: 'pending' | 'ready'
  items: QuyenRankingItem[]
}

export interface QuyenScoringDetail {
  slot: QuyenSlot
  tournament_name: string
  tree_path: string | null
  judges: QuyenJudgeScore[]
  ranking_group: QuyenRankingGroup | null
  audit_count: number
}

export interface QuyenJudgePanel {
  slot: QuyenSlot
  tournament_name: string
  tree_path: string | null
  judge: QuyenJudgeScore
}

export interface QuyenDisplayJudge {
  judge_slot: number
  assigned_user_name: string | null
  is_ready: boolean
  has_submitted: boolean
  score: number | null
}

export interface QuyenDisplayDetail {
  slot: QuyenSlot
  tournament_name: string
  tree_path: string | null
  judges: QuyenDisplayJudge[]
}

// ── Dynamic Tournament Structure types ────────────────────────────────────

export interface TournamentStructureNode {
  id:            number
  tournament_id: number
  parent_id:     number | null
  level:         number        // 0=Gender 1=Category 2=Group 3=WeightClass
  node_type:     'group' | 'weight_class'
  name:          string
  node_code:     string | null // machine-readable code: "M","F","1A","45"...
  rule_json:     Record<string, unknown> | null  // eligibility rules
  sort_order:    number
  student_count: number
  created_at:    string
  updated_at:    string
  children:      TournamentStructureNode[]  // only present in tree format
}

export interface TournamentKata {
  id:            number
  tournament_id: number
  division:      'individual' | 'team'
  name:          string
  description:   string | null
  sort_order:    number
  usage_count:   number
  team_size:     number
  min_team_size: number | null
}

export interface ContestTypeItem {
  type:      'sparring' | 'kata'
  kata_id:   number | null
  kata_name: string | null
}

export interface StudentRegistration {
  student_id:    number
  tournament_id: number
  node_id:       number
  classification_node_id: number | null
  sparring_weight_id: number | null
  node_path:     string
  registered_at: string
  contest_types: ContestTypeItem[]
}

export interface NodeStats {
  total_nodes:          number
  total_weight_classes: number
  total_students:       number
}

export interface NodesResponse {
  tournament_id:      number
  tournament_name:    string
  tournament_status:  string
  nodes:              TournamentStructureNode[]
  stats:              NodeStats
}

export interface KatasResponse {
  tournament_id: number
  katas:         TournamentKata[]
  total:         number
}

export interface TeamKataRegistrationItem {
  node_id: number
  node_path: string
  kata_id: number
  kata_name: string
}

export interface TeamKataRegistrationResponse {
  tournament_id: number
  club_id: number
  registrations: TeamKataRegistrationItem[]
}

export interface TeamKataMemberItem {
  student_id:   number
  student_name: string
  club_name:    string
}

export interface TeamKataMembersResponse {
  tournament_id: number
  club_id:       number
  node_id:       number
  kata_id:       number
  team_size:     number
  members:       TeamKataMemberItem[]
}

export interface NodeStudentItem {
  student_id:         number
  student_name:       string
  assigned_node_id:   number
  assigned_node_name: string
  contest_types:      ContestTypeItem[]
}

export interface NodeStudentsResponse {
  node_id:   number
  node_path: string
  students:  NodeStudentItem[]
  total:     number
}

// ── Dynamic bracket tree ──────────────────────────────────────────────────────

export interface BracketLeafParticipant {
  student_id: number
  full_name: string
}

export interface BracketLeafInfo {
  weight_class_id: number
  bracket_status: 'NOT_GENERATED' | 'GENERATING' | 'GENERATED'
  total_players: number
  players: string[]
  participants: BracketLeafParticipant[]
}

export interface BracketNodeItem {
  id: number
  name: string
  node_type: 'group' | 'weight_class'
  sort_order: number
  leaf_info: BracketLeafInfo | null
  children: BracketNodeItem[]
}

export interface BracketTreeResponse {
  tournament_id: number
  tournament_name: string
  tournament_status: string
  nodes: BracketNodeItem[]
}

// ── Match detail (for scoring panel) ───────────────────────────────────────

export interface MatchDetail {
  id: number
  tournament_id: number
  match_code: string | null
  round: number
  match_number: number
  court: string | null
  started_at: string | null
  finished_at: string | null
  player1_name: string | null
  player2_name: string | null
  player1_club: string | null
  player2_club: string | null
  player1_avatar_url: string | null
  player2_avatar_url: string | null
  score1: number | null
  score2: number | null
  winner: number | null
  status: 'pending' | 'ready' | 'checking' | 'ongoing' | 'completed'
  is_bye: boolean
  weight_class_name: string
  category: string
  age_type_code: string
  gender: string
  current_hiep: number
  match_phase: 'not_started' | 'round_1' | 'break' | 'round_2' | 'extra_time' | 'draw_pending' | 'finished' | 'confirmed'
  round_duration_seconds: number
  break_duration_seconds: number
  assigned_judges_count: number
  ready_judges_count: number
  submitted_judges_count: number
  judges: MatchJudgeAssignment[]
  timer_active: boolean
}

export interface MatchJudgeAssignment {
  judge_slot: number
  assigned_user_id: number | null
  assigned_user_name: string | null
  is_ready: boolean
  ready_at: string | null
  score1: number | null
  score2: number | null
  has_submitted: boolean
}

export interface MatchJudgePanelDetail {
  match_id: number
  tournament_name: string
  player1_name: string | null
  player2_name: string | null
  weight_class_name: string
  status: string
  started_at: string | null
  judge: MatchJudgeAssignment | null
}

export interface RefereeCurrentAssignment {
  kind: 'match' | 'quyen'
  entity_id: number
  judge_slot: number
  route: string
  status: string
  title: string
}

export interface MatchScoreLog {
  id: number
  match_id: number
  actor_type: string
  actor_name: string | null
  action: string
  side: number | null
  delta: number | null
  score1_after: number | null
  score2_after: number | null
  match_phase: string | null
  description: string | null
  created_at: string
}

export interface ConsensusTurnVote {
  id: number
  judge_slot: number
  judge_user_id: number | null
  player_side: string   // 'RED' | 'BLUE'
  score_type: string    // '+1' | '+2' | '-1'
  press_order: number
}

export interface ConsensusTurn {
  id: number
  match_id: number
  match_phase: string | null
  is_consensus: boolean
  result_side: string | null
  result_type: string | null
  result_delta: number | null
  score1_after: number | null
  score2_after: number | null
  agreeing_slots: string | null   // "1,2,3"
  created_at: string
  votes: ConsensusTurnVote[]
}

// ── Realtime WebSocket scoring types ────────────────────────────────────────

export interface ConsensusInfo {
  sequence: [string, string][]
  judge_count: number
  red_delta: number
  blue_delta: number
}

export interface PendingSlot {
  playerSide: 'RED' | 'BLUE'
  scoreType: '+1' | '+2' | '-1'
  slotIndex: number
  judgeCount: number
}

export interface JudgeActivity {
  judgeSlot: number
  playerSide: 'RED' | 'BLUE'
  scoreType: '+1' | '+2' | '-1'
  count: number
  accumulatedDelta: number
  pressDeltas: number[]
}

export interface ConfirmedSlot {
  playerSide: 'RED' | 'BLUE'
  scoreType: '+1' | '+2' | '-1'
  delta: number
}

export type WSInbound =
  | { type: 'snapshot'; match_id: number; status: string; score1: number; score2: number; judge_slot: number | null }
  | { type: 'score_update'; match_id: number; score1: number; score2: number; confirmed_slots: ConfirmedSlot[] }
  | { type: 'pending_update'; match_id: number; pending: PendingSlot[]; judgeInputs: JudgeActivity[] }
  | { type: 'match_state'; match_phase: string; status: string; score1: number; score2: number; timer_active: boolean }
  | { type: 'input_ack'; judge_slot: number; player_side: string; score_type: string }
  | { type: 'judge_ready'; ready_count: number }
  | { type: 'error'; code: string }
  | { type: 'pong' }

export type WSOutbound =
  | { type: 'judge_input'; playerSide: 'RED' | 'BLUE'; scoreType: '+1' | '+2' | '-1'; sequenceIndex: number; createdAt: number }
  | { type: 'ping' }
  | { type: 'admin_cmd'; cmd: 'begin' }
  | { type: 'admin_cmd'; cmd: 'end_round'; score1: number; score2: number }
  | { type: 'admin_cmd'; cmd: 'start_round' }
  | { type: 'admin_cmd'; cmd: 'draw_result'; winner: 1 | 2 }
  | { type: 'admin_cmd'; cmd: 'live_score'; score1: number; score2: number; yellow_cards1?: number | null; yellow_cards2?: number | null }
  | { type: 'admin_cmd'; cmd: 'timer_active'; active: boolean }
