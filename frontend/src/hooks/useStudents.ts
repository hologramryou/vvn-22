import { useState, useEffect, useCallback } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchStudents, fetchClubs } from '../api/students'

const useDebounce = (value: string, delay: number) => {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

// ── Filter state ───────────────────────────────────────────────────────────────

export interface FilterState {
  keyword: string
  clubId: string
  event: string
  gender: string
  dynamicNodeId: string
  weightClass: string
  quyenSelection: string
  categoryType: string
  categoryLoai: string
  weightVerified: string   // '' | 'true' | 'false'
}

export const DEFAULT_FILTERS: FilterState = {
  keyword: '',
  clubId: '',
  event: '',
  gender: '',
  dynamicNodeId: '',
  weightClass: '',
  quyenSelection: '',
  categoryType: '',
  categoryLoai: '',
  weightVerified: '',
}

// ── Saved filter ───────────────────────────────────────────────────────────────

export interface SavedFilter {
  id: string
  name: string
  filters: FilterState
}

// ── LocalStorage helpers ───────────────────────────────────────────────────────

function username(): string {
  return localStorage.getItem('user_name') ?? 'default'
}

function filtersKey(): string {
  return `student_filters_${username()}`
}

function savedFiltersKey(): string {
  return `student_saved_filters_${username()}`
}

function loadFilters(): FilterState {
  try {
    const raw = localStorage.getItem(filtersKey())
    if (!raw) return DEFAULT_FILTERS
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_FILTERS
  }
}

function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(savedFiltersKey())
    if (!raw) return []
    return JSON.parse(raw) as SavedFilter[]
  } catch {
    return []
  }
}

function persistFilters(f: FilterState) {
  try { localStorage.setItem(filtersKey(), JSON.stringify(f)) } catch { /* ignore */ }
}

function persistSavedFilters(sf: SavedFilter[]) {
  try { localStorage.setItem(savedFiltersKey(), JSON.stringify(sf)) } catch { /* ignore */ }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export const useStudents = (tournamentId?: number) => {
  const [filters, setFilters] = useState<FilterState>(() => loadFilters())
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => loadSavedFilters())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { keyword, clubId, event, gender, dynamicNodeId, weightClass, quyenSelection, categoryType, categoryLoai, weightVerified } = filters
  const debouncedKeyword = useDebounce(keyword, 300)

  // Reset page on filter change
  useEffect(() => {
    setPage(1)
  }, [debouncedKeyword, clubId, event, gender, dynamicNodeId, weightClass, quyenSelection, categoryType, categoryLoai, weightVerified, pageSize])

  // Persist active filters
  useEffect(() => { persistFilters(filters) }, [filters])

  // Persist saved filters
  useEffect(() => { persistSavedFilters(savedFilters) }, [savedFilters])

  const update = useCallback((patch: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...patch }))
  }, [])

  // Setters — cascading resets where needed
  const setKeyword        = (v: string) => update({ keyword: v })
  const setClubId         = (v: string) => update({ clubId: v })
  const setCategoryType   = (v: string) => update({ categoryType: v, categoryLoai: '', dynamicNodeId: '', event: '', weightClass: '', quyenSelection: '' })
  const setCategoryLoai   = (v: string) => update({ categoryLoai: v })
  const setGender         = (v: string) => update({ gender: v, dynamicNodeId: '', weightClass: '', quyenSelection: '' })
  const setEvent          = (v: string) => update({ event: v, weightClass: '', quyenSelection: '' })
  const setWeightClass    = (v: string) => update({ weightClass: v })
  const setQuyenSelection = (v: string) => update({ quyenSelection: v })
  const setWeightVerified = (v: string) => update({ weightVerified: v })
  const setDynamicTreeFilter = useCallback((next: {
    gender?: string
    dynamicNodeId?: string
    categoryType?: string
    categoryLoai?: string
    weightClass?: string
  }) => {
    setFilters(prev => ({
      ...prev,
      gender: Object.prototype.hasOwnProperty.call(next, 'gender') ? (next.gender ?? '') : prev.gender,
      dynamicNodeId: Object.prototype.hasOwnProperty.call(next, 'dynamicNodeId') ? (next.dynamicNodeId ?? '') : prev.dynamicNodeId,
      categoryType: Object.prototype.hasOwnProperty.call(next, 'categoryType') ? (next.categoryType ?? '') : prev.categoryType,
      categoryLoai: Object.prototype.hasOwnProperty.call(next, 'categoryLoai') ? (next.categoryLoai ?? '') : prev.categoryLoai,
      weightClass: Object.prototype.hasOwnProperty.call(next, 'weightClass') ? (next.weightClass ?? '') : prev.weightClass,
    }))
  }, [])

  // Saved filter actions
  const saveCurrentFilter = useCallback((name: string) => {
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: name.trim(),
      filters: { ...filters },
    }
    setSavedFilters(prev => [...prev, newFilter])
  }, [filters])

  const applyFilter = useCallback((id: string) => {
    const sf = savedFilters.find(f => f.id === id)
    if (sf) setFilters({ ...DEFAULT_FILTERS, ...sf.filters })
  }, [savedFilters])

  const deleteFilter = useCallback((id: string) => {
    setSavedFilters(prev => prev.filter(f => f.id !== id))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS)
  }, [])

  const query = useQuery({
    queryKey: ['students', tournamentId, debouncedKeyword, clubId, event, gender, dynamicNodeId, weightClass, quyenSelection, categoryType, categoryLoai, weightVerified, page, pageSize],
    queryFn: () => fetchStudents({
      ...(tournamentId      && { tournament_id: tournamentId }),
      ...(debouncedKeyword  && { keyword: debouncedKeyword }),
      ...(clubId            && { club_id: clubId }),
      ...(event             && { event }),
      ...(gender            && { gender }),
      ...(dynamicNodeId     && { dynamic_node_id: dynamicNodeId }),
      ...(weightClass       && { weight_class: weightClass }),
      ...(quyenSelection    && { quyen_selection: quyenSelection }),
      ...(dynamicNodeId ? {} : {
        ...(categoryType  && { category_type: categoryType }),
        ...(categoryLoai  && { category_loai: categoryLoai }),
      }),
      ...(weightVerified    && { weight_verified: weightVerified }),
      status: 'active',
      page,
      page_size: pageSize,
    }),
    enabled: tournamentId != null,
    placeholderData: keepPreviousData,
  })

  const clubsQuery = useQuery({ queryKey: ['clubs'], queryFn: fetchClubs, staleTime: 300_000 })

  const hasActiveFilter = !!(keyword || clubId || event || gender || dynamicNodeId || weightClass || quyenSelection || categoryType || categoryLoai || weightVerified)

  return {
    ...query,
    clubs: clubsQuery.data ?? [],
    // filter values
    keyword, setKeyword,
    clubId, setClubId,
    event, setEvent,
    gender, setGender,
    dynamicNodeId,
    weightClass, setWeightClass,
    quyenSelection, setQuyenSelection,
    categoryType, setCategoryType,
    categoryLoai, setCategoryLoai,
    weightVerified, setWeightVerified,
    setDynamicTreeFilter,
    // saved filters
    savedFilters,
    saveCurrentFilter,
    applyFilter,
    deleteFilter,
    resetFilters,
    hasActiveFilter,
    page, setPage,
    pageSize, setPageSize,
  }
}
