import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertCircle, Download, Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import jsPDF from 'jspdf'
import { domToCanvas } from 'modern-screenshot'
import { getBracketExport } from '../../api/tournaments'
import type { BracketExportPath, BracketMatch } from '../../types/tournament'

type ExportScope = 'selected' | 'all'

interface BracketExportModalProps {
  tournamentId: number
  tournamentName: string
  selectedNodeId: number | null
  selectedTreePath: string | null
  onClose: () => void
}

const MATCH_H = 96
const MATCH_W = 160
const GAP = 18
const CONN_W = 24
const UNIT = MATCH_H + GAP
const CARD_MID = 40
const EXPORT_PAGE_W = 1123
const EXPORT_PAGE_H = 794
const PDF_PAGE_W = 297
const PDF_PAGE_H = 210
const PDF_MARGIN = 8

interface BracketLayoutData {
  rounds: number[]
  byRound: Record<number, BracketMatch[]>
  totalRounds: number
  totalWidth: number
  totalHeight: number
}

function getRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return 'Chung kết'
  if (round === totalRounds - 1) return 'Bán kết'
  if (round === totalRounds - 2) return 'Tứ kết'
  return `Vòng ${round}`
}

function formatDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function buildFileName(tournamentId: number, scope: ExportScope) {
  const dateStr = formatDate(new Date())
  return scope === 'selected'
    ? `tournament-bracket-path-${tournamentId}-${dateStr}.pdf`
    : `tournament-bracket-all-paths-${tournamentId}-${dateStr}.pdf`
}

function getBracketLayout(matches: BracketMatch[]): BracketLayoutData | null {
  const byRound: Record<number, BracketMatch[]> = {}
  for (const match of matches) {
    if (!byRound[match.round]) byRound[match.round] = []
    byRound[match.round].push(match)
  }

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b)
  if (rounds.length === 0) return null

  for (const round of rounds) {
    byRound[round].sort((a, b) => a.match_number - b.match_number)
  }

  const totalRounds = rounds[rounds.length - 1]
  const totalHeight = byRound[rounds[0]].length * UNIT + MATCH_H
  const totalWidth = rounds.reduce((sum, _, roundIndex) => {
    const hasNext = roundIndex < rounds.length - 1
    return sum + MATCH_W + (hasNext ? CONN_W : 0)
  }, 0)

  return {
    rounds,
    byRound,
    totalRounds,
    totalWidth,
    totalHeight,
  }
}

function getBracketScale(layout: BracketLayoutData, hasPlayers: boolean): number {
  const availableWidth = EXPORT_PAGE_W - 96
  const availableHeight = hasPlayers ? 390 : 470
  const fitScale = Math.min(
    availableWidth / layout.totalWidth,
    availableHeight / layout.totalHeight,
  )

  const roundCap =
    layout.totalRounds <= 1 ? 4.2
    : layout.totalRounds === 2 ? 3
    : layout.totalRounds === 3 ? 1.9
    : 1.2

  return Math.max(0.5, Math.min(roundCap, fitScale))
}

function ExportBracketView({
  matches,
  hasPlayers,
}: {
  matches: BracketMatch[]
  hasPlayers: boolean
}) {
  const layout = getBracketLayout(matches)
  if (!layout) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 px-8 py-12 text-center text-sm text-gray-500">
        Tree path này chưa có sơ đồ thi đấu.
      </div>
    )
  }

  const scale = getBracketScale(layout, hasPlayers)
  const scaledWidth = layout.totalWidth * scale
  const scaledHeight = layout.totalHeight * scale

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50/60 px-8 py-7">
      <div className="mb-5 flex justify-center">
        <div
          className="flex"
          style={{ width: scaledWidth }}
        >
          {layout.rounds.map((round, roundIndex) => {
            const hasNext = roundIndex < layout.rounds.length - 1
            const columnWidth = (MATCH_W + (hasNext ? CONN_W : 0)) * scale
            const headerWidth = Math.max(104, columnWidth - 12)
            return (
              <div
                key={round}
                style={{ width: columnWidth, flexShrink: 0 }}
                className="flex justify-center px-1.5"
              >
                <div
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-blue-800 shadow-sm leading-tight"
                  style={{ width: headerWidth }}
                >
                  {getRoundLabel(round, layout.totalRounds)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex justify-center">
        <div style={{ width: scaledWidth, height: scaledHeight }}>
          <div
            className="origin-top-left"
            style={{
              width: layout.totalWidth,
              height: layout.totalHeight,
              transform: `scale(${scale})`,
            }}
          >
            <div className="flex items-start" style={{ minWidth: 'max-content' }}>
              {layout.rounds.map((round, roundIndex) => {
                const matchesInRound = layout.byRound[round]
                const spacing = Math.pow(2, round - 1) * UNIT
                const topOffset = (Math.pow(2, round - 1) - 1) * UNIT / 2
                const hasNext = roundIndex < layout.rounds.length - 1
                const columnWidth = MATCH_W + (hasNext ? CONN_W : 0)

                return (
                  <div
                    key={round}
                    style={{ position: 'relative', width: columnWidth, height: layout.totalHeight, flexShrink: 0 }}
                  >
                    {matchesInRound.map((match, matchIndex) => {
                      const displayStatus = match.status

                      const statusLabel =
                        displayStatus === 'completed'
                          ? 'Kết thúc'
                          : displayStatus === 'checking' || displayStatus === 'ongoing'
                          ? 'Đang thi đấu'
                          : displayStatus === 'ready'
                          ? 'Sẵn sàng'
                          : 'Chờ'

                      const statusClass =
                        displayStatus === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : displayStatus === 'checking' || displayStatus === 'ongoing'
                          ? 'bg-amber-100 text-amber-700'
                          : displayStatus === 'ready'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-500'

                      const isCompleted = displayStatus === 'completed'

                      return (
                        <div
                          key={match.id}
                          style={{ position: 'absolute', top: topOffset + matchIndex * spacing, width: MATCH_W }}
                          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col"
                          // height controlled by MATCH_H via parent layout
                        >
                          {/* status bar */}
                          <div className="flex-shrink-0 flex items-center justify-between gap-1 px-2 py-1 border-b border-gray-100 bg-gray-50/80">
                            <span className="whitespace-nowrap rounded bg-slate-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white leading-4">
                              #{match.schedule_order ?? match.match_number}
                            </span>
                            <span className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* player 1 — red */}
                          <div className={`flex-1 flex items-center gap-1 px-2 border-b border-gray-100 ${match.winner === 1 ? 'bg-emerald-50' : 'bg-red-50/60'}`}>
                            {match.winner === 1
                              ? <span className="text-emerald-500 flex-shrink-0 text-[10px]">▶</span>
                              : <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                            }
                            <span className={`text-[11px] truncate font-medium flex-1 ${
                              !match.player1_name ? 'text-gray-300 italic'
                              : match.winner === 1 ? 'text-emerald-700 font-semibold'
                              : match.winner === 2 ? 'text-gray-400 line-through'
                              : 'text-red-700'
                            }`}>
                              {match.player1_name || '—'}
                            </span>
                            {isCompleted && !match.is_bye && (
                              <span className={`text-[10px] font-bold flex-shrink-0 ${match.winner === 1 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {match.score1 ?? 0}
                              </span>
                            )}
                          </div>

                          {/* player 2 — blue */}
                          <div className={`flex-1 flex items-center gap-1 px-2 ${match.winner === 2 ? 'bg-emerald-50' : 'bg-blue-50/60'}`}>
                            {match.winner === 2
                              ? <span className="text-emerald-500 flex-shrink-0 text-[10px]">▶</span>
                              : <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                            }
                            <span className={`text-[11px] truncate font-medium flex-1 ${
                              !match.player2_name || match.player2_name === 'BYE' ? 'text-gray-300 italic'
                              : match.winner === 2 ? 'text-emerald-700 font-semibold'
                              : match.winner === 1 ? 'text-gray-400 line-through'
                              : 'text-blue-700'
                            }`}>
                              {match.player2_name || '—'}
                            </span>
                            {isCompleted && !match.is_bye && (
                              <span className={`text-[10px] font-bold flex-shrink-0 ${match.winner === 2 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                {match.score2 ?? 0}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {hasNext && (
                      <svg style={{ position: 'absolute', left: MATCH_W, top: 0 }} width={CONN_W} height={layout.totalHeight}>
                        {matchesInRound
                          .filter((_, index) => index % 2 === 0)
                          .map((_, connectorIndex) => {
                            const y1 = topOffset + connectorIndex * 2 * spacing + CARD_MID
                            const y2 = topOffset + (connectorIndex * 2 + 1) * spacing + CARD_MID
                            const midY = (y1 + y2) / 2
                            const verticalX = CONN_W * 0.35
                            return (
                              <g key={connectorIndex}>
                                <line x1={0} y1={y1} x2={verticalX} y2={y1} stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
                                <line x1={0} y1={y2} x2={verticalX} y2={y2} stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
                                <line x1={verticalX} y1={y1} x2={verticalX} y2={y2} stroke="#93c5fd" strokeWidth="1.5" />
                                <line x1={verticalX} y1={midY} x2={CONN_W} y2={midY} stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
                              </g>
                            )
                          })}
                      </svg>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExportBracketPage({
  tournamentName,
  path,
  pageIndex,
  totalPages,
}: {
  tournamentName: string
  path: BracketExportPath
  pageIndex: number
  totalPages: number
}) {
  return (
    <div
      className="inline-flex flex-col bg-white px-12 py-10 text-gray-900"
      style={{ width: EXPORT_PAGE_W, minHeight: EXPORT_PAGE_H }}
    >
      <div className="mb-8 flex items-start justify-between gap-8">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Xuất sơ đồ giải đấu</div>
          <h1 className="text-3xl font-bold text-gray-900">{tournamentName}</h1>
          <p className="max-w-[760px] text-lg font-semibold text-blue-700">
            {path.tree_path || path.weight_class_name}
          </p>
        </div>
        <div className="w-[220px] flex-shrink-0 rounded-3xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-600">
          <div className="font-semibold text-gray-800">Thông tin</div>
          <div className="mt-2">Trang: {pageIndex + 1}/{totalPages}</div>
          <div>VDV: {path.total_players}</div>
          <div>Trạng thái: {path.bracket_status}</div>
        </div>
      </div>

      {path.players.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Danh sách VĐV</div>
          <div className="flex flex-wrap gap-2">
            {path.players.map((player) => (
              <span
                key={player}
                className="inline-flex items-center whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-xs font-medium text-blue-700"
              >
                {player}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2">
        <ExportBracketView matches={path.matches} hasPlayers={path.players.length > 0} />
      </div>
    </div>
  )
}

function addCanvasToPdf(pdf: jsPDF, canvas: HTMLCanvasElement, addNewPage = false) {
  const printableWidth = PDF_PAGE_W - PDF_MARGIN * 2
  const printableHeight = PDF_PAGE_H - PDF_MARGIN * 2
  const sliceHeightPx = Math.floor(canvas.width * (printableHeight / printableWidth))

  let offsetY = 0
  let pageIndex = 0

  while (offsetY < canvas.height) {
    const currentSliceHeight = Math.min(sliceHeightPx, canvas.height - offsetY)
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = currentSliceHeight

    const ctx = sliceCanvas.getContext('2d')
    if (!ctx) break

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      currentSliceHeight,
      0,
      0,
      sliceCanvas.width,
      sliceCanvas.height,
    )

    if (addNewPage || pageIndex > 0) {
      pdf.addPage('a4', 'landscape')
    }

    const renderedHeight = printableWidth * (sliceCanvas.height / sliceCanvas.width)
    pdf.addImage(
      sliceCanvas.toDataURL('image/png'),
      'PNG',
      PDF_MARGIN,
      PDF_MARGIN,
      printableWidth,
      renderedHeight,
    )

    offsetY += currentSliceHeight
    pageIndex += 1
  }
}

async function captureExportPage(
  tournamentName: string,
  path: BracketExportPath,
  pageIndex: number,
  totalPages: number,
) {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:-10000px;z-index:-1;pointer-events:none;background:#fff;'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(
    <ExportBracketPage
      tournamentName={tournamentName}
      path={path}
      pageIndex={pageIndex}
      totalPages={totalPages}
    />,
  )

  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  if ('fonts' in document) {
    await document.fonts.ready
  }

  const element = container.firstElementChild as HTMLElement
  const canvas = await domToCanvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
  })

  root.unmount()
  document.body.removeChild(container)
  return canvas
}

export function BracketExportModal({
  tournamentId,
  tournamentName,
  selectedNodeId,
  selectedTreePath,
  onClose,
}: BracketExportModalProps) {
  const [scope, setScope] = useState<ExportScope>(selectedNodeId ? 'selected' : 'all')
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canExportSelected = selectedNodeId != null

  async function doExport() {
    if (scope === 'selected' && !selectedNodeId) {
      setError('Chưa có tree path hiện tại để export.')
      return
    }

    setIsExporting(true)
    setProgress(0)
    setStatusText('Đang tải dữ liệu export...')
    setError(null)

    try {
      const data = await getBracketExport(
        tournamentId,
        scope === 'selected' ? selectedNodeId : undefined,
      )

      const exportablePaths = data.paths.filter((path) => path.matches.length > 0)
      if (exportablePaths.length === 0) {
        setError(
          scope === 'selected'
            ? 'Tree path hiện tại chưa có sơ đồ để export.'
            : 'Chưa có tree path nào đã generate sơ đồ để export.',
        )
        return
      }

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      for (let index = 0; index < exportablePaths.length; index++) {
        const path = exportablePaths[index]
        setStatusText(`Đang render ${index + 1}/${exportablePaths.length}: ${path.tree_path || path.weight_class_name}`)
        const canvas = await captureExportPage(tournamentName, path, index, exportablePaths.length)
        addCanvasToPdf(pdf, canvas, index > 0)

        setProgress(Math.round(((index + 1) / exportablePaths.length) * 100))
      }

      pdf.save(buildFileName(tournamentId, scope))
      onClose()
    } catch {
      setError('Có lỗi xảy ra khi export PDF. Vui lòng thử lại.')
    } finally {
      setIsExporting(false)
      setStatusText(null)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Export PDF sơ đồ thi đấu"
      subtitle="PDF sẽ render theo tree path, tự tách thêm trang nếu bracket quá dài."
      size="lg"
      disableOverlayClose={isExporting}
      footer={
        <>
          <button
            onClick={!isExporting ? onClose : undefined}
            disabled={isExporting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            onClick={doExport}
            disabled={isExporting || (scope === 'selected' && !canExportSelected)}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary,#1d4ed8)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export PDF
          </button>
        </>
      }
    >
      <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Tournament</div>
            <div className="mt-2 text-base font-semibold text-gray-900">{tournamentName}</div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Phạm vi export</div>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${scope === 'selected' ? 'border-[var(--color-primary,#1d4ed8)] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'} ${!canExportSelected ? 'opacity-60' : ''}`}>
              <input
                type="radio"
                name="export-scope"
                className="mt-1"
                checked={scope === 'selected'}
                onChange={() => setScope('selected')}
                disabled={!canExportSelected || isExporting}
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">Tree path hiện tại</div>
                <div className="mt-1 text-xs text-gray-500">
                  {selectedTreePath ?? 'Chưa có tree path đang được chọn.'}
                </div>
              </div>
            </label>

            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${scope === 'all' ? 'border-[var(--color-primary,#1d4ed8)] bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input
                type="radio"
                name="export-scope"
                className="mt-1"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                disabled={isExporting}
              />
              <div>
                <div className="text-sm font-semibold text-gray-900">Toàn bộ tree path</div>
                <div className="mt-1 text-xs text-gray-500">
                  Chỉ export các tree path đã generate sơ đồ thi đấu.
                </div>
              </div>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {(isExporting || progress > 0) && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center justify-between text-sm font-medium text-blue-800">
                <span>{statusText ?? 'Đang export PDF...'}</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-[var(--color-primary,#1d4ed8)] transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
      </div>
    </Modal>
  )
}
