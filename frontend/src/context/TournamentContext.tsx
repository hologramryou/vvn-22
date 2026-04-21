import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTournaments } from '../api/tournaments'
import type { TournamentListItem } from '../types/tournament'
import { DEFAULT_THEME } from '../styles/tokens'

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

function darken(hex: string, amount = 0.2): string {
  const h = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function lighten(hex: string, amount = 0.9): string {
  const h = hex.replace('#', '')
  const r = Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) + (255 - parseInt(h.slice(0, 2), 16)) * amount))
  const g = Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) + (255 - parseInt(h.slice(2, 4), 16)) * amount))
  const b = Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) + (255 - parseInt(h.slice(4, 6), 16)) * amount))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function injectTheme(primaryColor: string | null | undefined, gradientPrimary: string | null | undefined) {
  const primary = primaryColor ?? DEFAULT_THEME.primary
  const primaryDark = darken(primary, 0.35)
  const primaryLight = lighten(primary, 0.92)
  const h = primary.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const primaryText = luminance > 0.5 ? '#1e293b' : '#ffffff'

  const root = document.documentElement
  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-primary-dark', primaryDark)
  root.style.setProperty('--color-primary-light', primaryLight)
  root.style.setProperty('--color-primary-text', primaryText)
  root.style.setProperty('--color-primary-rgb', hexToRgb(primary))
  root.style.setProperty('--color-gradient-primary', gradientPrimary ?? primaryDark)
}

interface TournamentContextValue {
  tournaments: TournamentListItem[]
  selectedTournament: TournamentListItem | null
  setSelectedTournament: (t: TournamentListItem) => void
  isLoading: boolean
}

const TournamentContext = createContext<TournamentContextValue | null>(null)

const STORAGE_KEY = 'selected_tournament_id'

export const TournamentProvider = ({ children }: { children: ReactNode }) => {
  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: listTournaments,
    staleTime: 60_000,
  })

  const [selectedTournament, setSelectedTournamentState] = useState<TournamentListItem | null>(null)

  useEffect(() => {
    if (!tournaments.length) {
      setSelectedTournamentState(null)
      return
    }

    const storedId = localStorage.getItem(STORAGE_KEY)
    if (storedId) {
      const found = tournaments.find(t => t.id === Number(storedId))
      if (found) { setSelectedTournamentState(found); return }
    }
    // Auto-select first non-completed, or the very first if all completed
    const active = tournaments.find(t => t.status !== 'COMPLETED') ?? tournaments[0]
    setSelectedTournamentState(active ?? null)
  }, [tournaments])

  // Inject CSS theme vars whenever selected tournament changes
  useEffect(() => {
    injectTheme(selectedTournament?.primary_color, selectedTournament?.gradient_primary)
  }, [selectedTournament])

  const setSelectedTournament = (t: TournamentListItem) => {
    setSelectedTournamentState(t)
    localStorage.setItem(STORAGE_KEY, String(t.id))
  }

  return (
    <TournamentContext.Provider value={{ tournaments, selectedTournament, setSelectedTournament, isLoading }}>
      {children}
    </TournamentContext.Provider>
  )
}

export const useTournament = (): TournamentContextValue => {
  const ctx = useContext(TournamentContext)
  if (!ctx) throw new Error('useTournament must be used inside TournamentProvider')
  return ctx
}
