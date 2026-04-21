import { useCallback, useEffect, useRef, useState } from 'react'
import type { JudgeActivity, PendingSlot, WSInbound, WSOutbound } from '../types/tournament'
import { getWsUrl } from '../lib/serverConfig'

interface UseMatchScoringWSOptions {
  matchId: number | undefined
  enabled: boolean
  onScoreUpdate?: (score1: number, score2: number) => void
  onSnapshot?: (score1: number, score2: number, state?: { match_phase?: string; status?: string; timer_active?: boolean }) => void
  onPendingUpdate?: (pending: PendingSlot[], judgeInputs: JudgeActivity[]) => void
  onMatchState?: (state: {
    match_phase: string
    status: string
    score1: number
    score2: number
    timer_active: boolean
    winner?: number | null
    yellow_cards1?: number | null
    yellow_cards2?: number | null
  }) => void
  onJudgeReady?: (readyCount: number) => void
}

interface UseMatchScoringWSReturn {
  connected: boolean
  lastError: string | null
  sendJudgeInput: (playerSide: 'RED' | 'BLUE', scoreType: '+1' | '+2' | '-1') => void
  sendAdminCommand: (cmd: WSOutbound & { type: 'admin_cmd' }) => void
}

const BASE_DELAY_MS = 1000
const MAX_DELAY_MS = 10000
const PING_INTERVAL_MS = 25000

export function useMatchScoringWS({
  matchId,
  enabled,
  onScoreUpdate,
  onSnapshot,
  onPendingUpdate,
  onMatchState,
  onJudgeReady,
}: UseMatchScoringWSOptions): UseMatchScoringWSReturn {
  const wsRef = useRef<WebSocket | null>(null)
  const sequenceIndexRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isMountedRef = useRef(true)

  const [connected, setConnected] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  // Store callbacks in refs so connect() closure doesn't go stale
  const onScoreUpdateRef = useRef(onScoreUpdate)
  const onSnapshotRef = useRef(onSnapshot)
  const onPendingUpdateRef = useRef(onPendingUpdate)
  const onMatchStateRef = useRef(onMatchState)
  const onJudgeReadyRef = useRef(onJudgeReady)
  useEffect(() => { onScoreUpdateRef.current = onScoreUpdate }, [onScoreUpdate])
  useEffect(() => { onSnapshotRef.current = onSnapshot }, [onSnapshot])
  useEffect(() => { onPendingUpdateRef.current = onPendingUpdate }, [onPendingUpdate])
  useEffect(() => { onMatchStateRef.current = onMatchState }, [onMatchState])
  useEffect(() => { onJudgeReadyRef.current = onJudgeReady }, [onJudgeReady])

  const connect = useCallback(() => {
    if (!enabled || !matchId || !isMountedRef.current) return

    const token = localStorage.getItem('access_token') ?? ''
    // Anonymous (no token) connections are allowed as spectators — they receive
    // broadcasts but cannot send judge_input or admin_cmd messages.

    const wsBase = getWsUrl(true)
    const url = token
      ? `${wsBase}/ws/matches/${matchId}/scoring?token=${token}`
      : `${wsBase}/ws/matches/${matchId}/scoring`

    const ws = new WebSocket(url)
    wsRef.current = ws
    sequenceIndexRef.current = 0

    ws.onopen = () => {
      if (!isMountedRef.current) return
      setConnected(true)
      setLastError(null)
      reconnectAttemptsRef.current = 0
      // Keep idle connections alive through NAT/proxy timeouts
      if (pingTimerRef.current) clearInterval(pingTimerRef.current)
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = (ev: MessageEvent) => {
      if (!isMountedRef.current) return
      try {
        const msg = JSON.parse(ev.data) as WSInbound
        if (msg.type === 'score_update') {
          onScoreUpdateRef.current?.(msg.score1, msg.score2)
        } else if (msg.type === 'snapshot') {
          onSnapshotRef.current?.(msg.score1, msg.score2, {
            match_phase: (msg as unknown as Record<string, unknown>).match_phase as string | undefined,
            status: (msg as unknown as Record<string, unknown>).status as string | undefined,
            timer_active: (msg as unknown as Record<string, unknown>).timer_active as boolean | undefined,
          })
        } else if (msg.type === 'pending_update') {
          onPendingUpdateRef.current?.(msg.pending, msg.judgeInputs ?? [])
        } else if (msg.type === 'match_state') {
          onMatchStateRef.current?.(msg)
        } else if (msg.type === 'judge_ready') {
          onJudgeReadyRef.current?.(msg.ready_count)
        }
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = (ev: CloseEvent) => {
      if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null }
      if (!isMountedRef.current) return
      setConnected(false)

      // Don't reconnect on auth / not-found errors or intentional close
      if (ev.code === 4001 || ev.code === 4004 || ev.code === 1000) return

      const delay = Math.min(BASE_DELAY_MS * 2 ** reconnectAttemptsRef.current, MAX_DELAY_MS)
      reconnectAttemptsRef.current += 1
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      if (!isMountedRef.current) return
      setLastError('WebSocket connection error')
    }
  }, [matchId, enabled])

  useEffect(() => {
    isMountedRef.current = true
    connect()
    return () => {
      isMountedRef.current = false
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null }
      wsRef.current?.close(1000)
      wsRef.current = null
    }
  }, [connect])

  const sendJudgeInput = useCallback(
    (playerSide: 'RED' | 'BLUE', scoreType: '+1' | '+2' | '-1') => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return
      const msg: WSOutbound = {
        type: 'judge_input',
        playerSide,
        scoreType,
        sequenceIndex: sequenceIndexRef.current++,
        createdAt: Date.now(),
      }
      wsRef.current.send(JSON.stringify(msg))
    },
    [],
  )

  const sendAdminCommand = useCallback(
    (cmd: WSOutbound & { type: 'admin_cmd' }) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return
      wsRef.current.send(JSON.stringify(cmd))
    },
    [],
  )

  return { connected, lastError, sendJudgeInput, sendAdminCommand }
}
