import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { X, Download, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { domToCanvas } from 'modern-screenshot'
import jsPDF from 'jspdf'
import { AthleteCard } from './AthleteCard'
import type { StudentCardData } from '../../types/student'
import { categoryLabel, eventLabel, WEIGHT_CLASSES } from '../../lib/constants'

interface ExportModalProps {
  students: StudentCardData[]
  tournamentName?: string
  tournamentYear?: number
  exportMode?: 'single' | 'selected' | 'club'
  clubId?: number
  onClose: () => void
}

type Format = 'pdf' | 'png'
type CardSize = 'card' | 'a4'
type CardsPerPage = 1 | 2 | 4

function toCardProps(s: StudentCardData, tournamentName: string) {
  const genderKey = (s.gender === 'M' ? 'M' : 'F') as 'M' | 'F'
  const weightLabel = s.weight_class
    ? WEIGHT_CLASSES[genderKey].find(w => w.value === s.weight_class)?.label ?? `${s.weight_class} kg`
    : undefined
  const cat = s.registration_category
    ?? (s.category_type && s.category_loai
    ? (categoryLabel(s.category_type, s.category_loai) ?? undefined)
    : undefined)
  const content = s.registration_content?.length
    ? s.registration_content
    : [
        ...(s.compete_events?.map(eventLabel) ?? []),
      ].filter(Boolean)
  const birthYear = s.date_of_birth ? new Date(s.date_of_birth).getFullYear() : undefined
  return {
    athleteName: s.full_name,
    club: s.club_name ?? undefined,
    category: cat,
    weightClass: s.registration_weight_class_name ?? weightLabel,
    content,
    birthYear,
    competitionType: content[0],
    photoUrl: s.avatar_url ?? undefined,
    tournamentName,
    athleteCode: s.code,
  }
}

function formatDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Fetch ảnh từ URL → dataURL (base64).
 * Giải quyết CORS khi render canvas trên server:
 * - CSS background-image không thể bypass CORS khi convert sang canvas
 * - Fetch với credentials + convert sang blob URL → canvas không bị tainted
 */
async function toDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return url
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return url // fallback: dùng URL gốc nếu fetch lỗi
  }
}

/**
 * Capture một AthleteCard thành Canvas.
 * photoUrl được fetch trước thành dataURL để tránh CORS tainted canvas trên server.
 */
async function captureAthleteCard(
  props: ReturnType<typeof toCardProps>
): Promise<HTMLCanvasElement> {
  // Nếu có ảnh, fetch trước thành dataURL — tránh CORS khi render canvas
  const resolvedProps = props.photoUrl
    ? { ...props, photoUrl: await toDataUrl(props.photoUrl) }
    : props

  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;pointer-events:none;'
  document.body.appendChild(container)

  const root = createRoot(container)
  root.render(<AthleteCard {...resolvedProps} />)

  // Chờ React paint xong (2 animation frames) + fonts sẵn sàng
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  )
  await document.fonts.ready

  const el = container.firstElementChild as HTMLElement

  const canvas = await domToCanvas(el, {
    scale: 3,
    backgroundColor: '#f0f4ff',
  })

  root.unmount()
  document.body.removeChild(container)

  return canvas
}

export function ExportModal({
  students,
  tournamentName = 'Giải Vovinam Lương Tài Mở Rộng 2026',
  exportMode = 'single',
  clubId,
  onClose,
}: ExportModalProps) {
  const [format, setFormat] = useState<Format>('pdf')
  const [cardSize, setCardSize] = useState<CardSize>('card')
  const [cardsPerPage, setCardsPerPage] = useState<CardsPerPage>(1)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const previewStudent = students[0]
  const extraCount = students.length - 1

  async function doExport() {
    setIsExporting(true)
    setProgress(0)
    setError(null)

    try {
      const dateStr = formatDate(new Date())

      if (format === 'png' && students.length === 1) {
        const canvas = await captureAthleteCard(toCardProps(students[0], tournamentName))
        const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/png'))
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `athlete-card-${students[0].code}.png`
        a.click()
        URL.revokeObjectURL(url)
        setProgress(100)
        setTimeout(onClose, 500)
        return
      }

      const isA4 = cardSize === 'a4'
      const pageW = isA4 ? 210 : 105
      // Card ratio 360:590 → at 95mm wide ≈ 156mm + 10mm margin = 166mm
      const pageH = isA4 ? 297 : 166

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: isA4 ? 'a4' : [pageW, pageH],
      })

      for (let i = 0; i < students.length; i++) {
        try {
          const canvas = await captureAthleteCard(toCardProps(students[i], tournamentName))
          const imgData = canvas.toDataURL('image/png')

          if (i > 0 && i % cardsPerPage === 0) pdf.addPage()

          const slotIndex = i % cardsPerPage
          let x = 5, y = 5
          if (cardsPerPage === 2) {
            y = slotIndex === 0 ? 5 : pageH / 2 + 2.5
          } else if (cardsPerPage === 4) {
            x = slotIndex % 2 === 0 ? 5 : pageW / 2 + 2.5
            y = slotIndex < 2 ? 5 : pageH / 2 + 2.5
          }

          const drawW = cardsPerPage === 1 ? pageW - 10 : pageW / 2 - 7.5
          const drawH = drawW * (canvas.height / canvas.width)
          pdf.addImage(imgData, 'PNG', x, y, drawW, drawH)
        } catch {
          // skip card on error
        }

        setProgress(Math.round(((i + 1) / students.length) * 100))
        // Yield UI mỗi 5 cards
        if (i % 5 === 4) await new Promise(r => setTimeout(r, 0))
      }

      let filename = `athlete-cards-${dateStr}.pdf`
      if (exportMode === 'single') filename = `athlete-card-${students[0].code}.pdf`
      else if (exportMode === 'club' && clubId) filename = `club-athlete-cards-${clubId}-${dateStr}.pdf`

      pdf.save(filename)
      setProgress(100)
      setTimeout(onClose, 500)
    } catch {
      setError('Có lỗi xảy ra khi export. Vui lòng thử lại.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={!isExporting ? onClose : undefined} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Export thẻ VĐV</h2>
          <button
            onClick={!isExporting ? onClose : undefined}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40"
            disabled={isExporting}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2 px-5 py-5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Xem trước</p>
            <div style={{ zoom: 0.62 }}>
              {previewStudent && (
                <AthleteCard {...toCardProps(previewStudent, tournamentName)} />
              )}
            </div>
            {extraCount > 0 && (
              <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                + {extraCount} thẻ khác
              </span>
            )}
            <span className="text-xs text-gray-500">{students.length} thẻ sẽ được xuất</span>
          </div>

          {/* Options */}
          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Định dạng</p>
              <div className="flex gap-2">
                {(['pdf', 'png'] as Format[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      format === f ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f.toUpperCase()}
                    {f === 'png' && students.length > 1 && (
                      <span className="text-[10px] ml-1 opacity-70">(1 file/thẻ)</span>
                    )}
                  </button>
                ))}
              </div>
              {format === 'png' && students.length > 1 && (
                <p className="text-xs text-amber-600 mt-1.5">PNG: mỗi thẻ xuất thành 1 file riêng</p>
              )}
            </div>

            {format === 'pdf' && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Kích thước</p>
                <div className="flex gap-2">
                  {([['card', 'Kích thước thẻ'], ['a4', 'A4']] as [CardSize, string][]).map(([v, lbl]) => (
                    <button
                      key={v}
                      onClick={() => setCardSize(v)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        cardSize === v ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {format === 'pdf' && students.length > 1 && (
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Thẻ / trang</p>
                <div className="flex gap-2">
                  {([1, 2, 4] as CardsPerPage[]).map(n => (
                    <button
                      key={n}
                      onClick={() => setCardsPerPage(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        cardsPerPage === n ? 'bg-[var(--color-primary,#1d4ed8)] text-white border-[var(--color-primary,#1d4ed8)]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mb-3 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle size={15} className="flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <RotateCcw size={14} />
            </button>
          </div>
        )}

        {/* Progress */}
        {isExporting && (
          <div className="px-5 pb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Đang xuất...</span>
              <span className="text-xs font-medium text-blue-600">{progress}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary,#1d4ed8)] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Huỷ
          </button>
          <button
            onClick={doExport}
            disabled={isExporting || students.length === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-primary,#1d4ed8)] text-white hover:bg-[var(--color-primary-dark,#1e3a5f)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {isExporting ? 'Đang xuất...' : `Export ${students.length} thẻ`}
          </button>
        </div>
      </div>
    </div>
  )
}
