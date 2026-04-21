import { useState, useRef } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Modal } from '../ui/Modal'
import { importStudents } from '../../api/students'
import * as structureAPI from '../../api/tournament_structure'
import type { TournamentStructureNode } from '../../types/tournament'

interface Props {
  onClose: () => void
  tournamentId?: number
}

type Step = 'select' | 'uploading' | 'result'

interface ImportResult {
  total_rows: number; success_rows: number; failed_rows: number
  errors: { row: number; status: string; full_name: string | null; error: string | null }[]
}

const MAX_MB = 10
// Phải có đủ 4 cột này — khớp với backend REQUIRED_EXCEL_COLS
const REQUIRED_COLS = ['ho_ten', 'gioi_tinh', 'ten_cau_lac_bo', 'dai_cap']
// Các cột tuỳ chọn cơ bản
const OPTIONAL_COLS = ['ngay_sinh', 'cccd', 'so_dien_thoai', 'ngay_nhap_mon']
// Cột đăng ký thi đấu (nếu có tournament)
const REGISTRATION_COLS = ['hang_muc', 'noi_dung', 'hang_can']

// Build danh sách tree path từ flat nodes để đưa vào template
function buildTreePaths(nodes: TournamentStructureNode[]): { gender: string; path: string; weightClass: string }[] {
  const leaves = nodes.filter(n => !nodes.some(c => c.parent_id === n.id) && n.node_type === 'weight_class')
  const result: { gender: string; path: string; weightClass: string }[] = []

  for (const leaf of leaves) {
    // Build ancestor chain
    const chain: TournamentStructureNode[] = [leaf]
    let cur: TournamentStructureNode | undefined = leaf
    while (cur?.parent_id != null) {
      const parent = nodes.find(n => n.id === cur!.parent_id)
      if (!parent) break
      chain.unshift(parent)
      cur = parent
    }
    if (chain.length < 2) continue
    const genderNode = chain[0]
    const weightNode = chain[chain.length - 1]
    // hang_muc = level 1 node (child of gender)
    const categoryNode = chain[1]
    // middle path between category and weight class (if any)
    const midPath = chain.slice(2, -1).map(n => n.name).join(' › ')
    const pathLabel = midPath ? `${categoryNode.name} › ${midPath}` : categoryNode.name

    result.push({
      gender: genderNode.name,
      path: pathLabel,
      weightClass: weightNode.name,
    })
  }
  return result
}

export const ImportModal = ({ onClose, tournamentId }: Props) => {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep]       = useState<Step>('select')
  const [file, setFile]       = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [result, setResult]   = useState<ImportResult | null>(null)
  const [apiError, setApiError] = useState('')

  const nodesQ = useQuery({
    queryKey: ['tournament-structure', 'nodes', tournamentId],
    queryFn: () => structureAPI.getNodes(tournamentId!, 'flat'),
    enabled: !!tournamentId,
    staleTime: 60_000,
  })
  const flatNodes: TournamentStructureNode[] = nodesQ.data?.nodes ?? []
  const treePaths = flatNodes.length > 0 ? buildTreePaths(flatNodes) : []

  const mutation = useMutation({
    mutationFn: importStudents,
    onSuccess: (data: ImportResult) => {
      setResult(data)
      setStep('result')
      qc.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      if (detail?.code === 'MISSING_COLUMNS') setApiError(`Thiếu cột bắt buộc: ${detail.message.replace('Thiếu cột: ','')}`)
      else if (detail?.code === 'FILE_TOO_LARGE') setApiError('File vượt quá 10MB')
      else setApiError('Lỗi không xác định. Vui lòng thử lại.')
      setStep('select')
    },
  })

  const pickFile = (f: File) => {
    setFileError(''); setApiError('')
    if (!f.name.endsWith('.xlsx')) { setFileError('Chỉ chấp nhận file .xlsx'); return }
    if (f.size > MAX_MB * 1024 * 1024) { setFileError(`File không được vượt quá ${MAX_MB}MB`); return }
    setFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) pickFile(f)
  }

  const doImport = () => {
    if (!file) return
    setStep('uploading')
    mutation.mutate(file)
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const hasTournament = treePaths.length > 0

    // ── Sheet 1: Dữ liệu nhập — luôn có cột đăng ký thi đấu ──
    const headers = [...REQUIRED_COLS, ...OPTIONAL_COLS, ...REGISTRATION_COLS]
    const hintRow = [
      'Họ và tên đầy đủ (*)',
      'Nam hoặc Nữ (*)',
      'Tên CLB đúng trong hệ thống (*)',
      'Tên đai cấp (*) — xem sheet Tham Khảo',
      'Ngày sinh DD/MM/YYYY',
      'Số CCCD/CMND 12 chữ số',
      'Số điện thoại',
      'Ngày nhập môn DD/MM/YYYY',
      'Hạng mục thi đấu — xem sheet Tham Khảo',
      'Đối kháng / Quyền / Đối kháng và Quyền',
      'Hạng cân — xem sheet Tham Khảo',
    ]
    // Lấy ví dụ từ tree thực nếu có, fallback về placeholder
    const ex1Path = treePaths.find(p => p.gender === 'Nam')
    const ex2Path = treePaths.find(p => p.gender === 'Nữ')
    const sampleRows = [
      [
        'Nguyễn Văn A', 'Nam', 'CLB Vovinam Q1', 'Lam đai nhập môn',
        '15/03/2005', '079200012345', '0912345678', '01/09/2020',
        ex1Path?.path ?? 'Lứa tuổi 1a', 'Đối kháng', ex1Path?.weightClass ?? '60 kg',
      ],
      [
        'Trần Thị B', 'Nữ', 'CLB Vovinam Q3', 'Lam đai I',
        '22/07/2008', '079200054321', '0987654321', '15/03/2021',
        ex2Path?.path ?? 'Lứa tuổi 1a', 'Quyền', '',
      ],
      [
        'Lê Văn C', 'Nam', 'CLB Vovinam Q1', 'Hoàng đai',
        '03/11/2001', '', '', '10/01/2018',
        ex1Path?.path ?? 'Lứa tuổi 1a', 'Đối kháng và Quyền', ex1Path?.weightClass ?? '72 kg',
      ],
    ]
    const wsData = XLSX.utils.aoa_to_sheet([headers, hintRow, ...sampleRows])
    wsData['!cols'] = headers.map(() => ({ wch: 26 }))
    wsData['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(wb, wsData, 'Môn sinh')

    // ── Sheet 2: Tham khảo giá trị hợp lệ ──
    const refData: (string | number)[][] = [
      ['── GIỚI TÍNH ──', '', ''],
      ['Giá trị hợp lệ', 'Ghi chú', ''],
      ['Nam', 'Môn sinh nam', ''],
      ['Nữ', 'Môn sinh nữ', ''],
      ['', '', ''],
      ['── ĐAI CẤP (dai_cap) ──', '', ''],
      ['Tên đai cấp', 'Alias không dấu cũng chấp nhận', ''],
      ['Tự vệ nhập môn',  'tu ve nhap mon', ''],
      ['Lam đai nhập môn','lam dai nhap mon', ''],
      ['Lam đai I',       'lam dai i', ''],
      ['Lam đai II',      'lam dai ii', ''],
      ['Lam đai III',     'lam dai iii', ''],
      ['Chuẩn Hoàng đai', 'chuan hoang dai', ''],
      ['Hoàng đai',       'hoang dai', ''],
      ['Hoàng đai I',     'hoang dai i', ''],
      ['Hoàng đai II',    'hoang dai ii', ''],
      ['Hoàng đai III',   'hoang dai iii', ''],
      ['Chuẩn Hồng đai',  'chuan hong dai', ''],
      ['Hồng đai I → VI', 'hong dai i → hong dai vi', ''],
      ['Bạch đai',        'bach dai', ''],
      ['', '', ''],
      ['── NỘI DUNG THI ĐẤU (noi_dung) ──', '', ''],
      ['Giá trị', 'Ý nghĩa', ''],
      ['Đối kháng',          'Chỉ thi đối kháng', ''],
      ['Quyền',              'Chỉ thi quyền', ''],
      ['Đối kháng và Quyền', 'Thi cả hai', ''],
      ['', '', ''],
      ...(hasTournament && treePaths.length > 0 ? [
        ['── HẠNG MỤC & HẠNG CÂN CỦA GIẢI ĐẤU (hang_muc / hang_can) ──', '', ''],
        ['Giới tính', 'hang_muc (hạng mục)', 'hang_can (hạng cân)'],
        ...treePaths.map(p => [p.gender, p.path, p.weightClass]),
      ] : [
        ['── HẠNG MỤC & HẠNG CÂN ──', '', ''],
        ['Chưa có giải đấu active. Chọn giải đấu trước khi tải template để có danh sách hạng mục.', '', ''],
      ]),
    ]
    const wsRef = XLSX.utils.aoa_to_sheet(refData)
    wsRef['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsRef, 'Tham Khảo')

    XLSX.writeFile(wb, 'mau_import_mon_sinh.xlsx')
  }

  return (
    <Modal open title="Import môn sinh từ Excel" onClose={onClose} size="md">
      <div>

          {/* ── Step: select ── */}
          {step === 'select' && <>
            {/* Drop zone */}
            <div
              onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
              }`}>
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
                onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])} />
              <FileSpreadsheet size={36} className={`mx-auto mb-2 ${file ? 'text-green-500' : 'text-gray-300'}`} />
              {file ? (
                <>
                  <p className="font-medium text-gray-900 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB · Click để đổi file</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-700 text-sm">Kéo thả file .xlsx vào đây</p>
                  <p className="text-xs text-gray-400 mt-1">hoặc click để chọn file · Tối đa {MAX_MB}MB</p>
                </>
              )}
            </div>

            {fileError && (
              <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle size={14} /> {fileError}
              </div>
            )}
            {apiError && (
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{apiError}</div>
            )}

            {/* Cột bắt buộc / tuỳ chọn */}
            <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Cột bắt buộc <span className="text-red-500">*</span></p>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIRED_COLS.map(c => (
                    <span key={c} className="text-[10px] font-mono bg-white border border-red-200 px-2 py-0.5 rounded text-red-600">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5">Cột tuỳ chọn</p>
                <div className="flex flex-wrap gap-1.5">
                  {OPTIONAL_COLS.map(c => (
                    <span key={c} className="text-[10px] font-mono bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-blue-600 mb-1.5">Cột đăng ký thi đấu</p>
                <div className="flex flex-wrap gap-1.5">
                  {REGISTRATION_COLS.map(c => (
                    <span key={c} className="text-[10px] font-mono bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-600">{c}</span>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {treePaths.length > 0
                    ? 'Danh sách hạng mục & hạng cân theo giải hiện tại có trong sheet Tham Khảo'
                    : 'Chọn giải đấu trước khi tải template để có danh sách hạng mục thực tế'}
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={downloadTemplate}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                Tải file mẫu (.xlsx)
              </button>
              <button onClick={doImport} disabled={!file}
                className="flex-2 flex-[2] py-2.5 bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark,#1e3a5f)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                <Upload size={15} /> Import
              </button>
            </div>
          </>}

          {/* ── Step: uploading ── */}
          {step === 'uploading' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-2 border-[var(--color-primary,#1d4ed8)] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">Đang xử lý file...</p>
              <p className="text-xs text-gray-400">{file?.name}</p>
            </div>
          )}

          {/* ── Step: result ── */}
          {step === 'result' && result && (
            <div className="flex flex-col gap-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-gray-50 rounded-xl">
                  <div className="text-xl font-bold text-gray-900">{result.total_rows}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Tổng dòng</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <div className="text-xl font-bold text-green-700">{result.success_rows}</div>
                  <div className="text-xs text-green-600 mt-0.5">Thành công</div>
                </div>
                <div className={`text-center p-3 rounded-xl ${result.failed_rows > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <div className={`text-xl font-bold ${result.failed_rows > 0 ? 'text-red-600' : 'text-gray-400'}`}>{result.failed_rows}</div>
                  <div className={`text-xs mt-0.5 ${result.failed_rows > 0 ? 'text-red-500' : 'text-gray-400'}`}>Lỗi</div>
                </div>
              </div>

              {result.success_rows > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
                  <CheckCircle size={16} />
                  Import thành công {result.success_rows} môn sinh vào hệ thống.
                </div>
              )}

              {/* Error rows */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Chi tiết lỗi:</p>
                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                    {result.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg border border-red-100">
                        <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <span className="font-medium text-gray-700">Dòng {e.row}</span>
                          {e.full_name && <span className="text-gray-500"> · {e.full_name}</span>}
                          <span className="text-red-600"> — {e.error}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {result.failed_rows > 0 && (
                  <button onClick={() => { setStep('select'); setFile(null); setResult(null) }}
                    className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Import lại
                  </button>
                )}
                <button onClick={onClose}
                  className="flex-1 py-2.5 bg-[var(--color-primary,#1d4ed8)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark,#1e3a5f)] transition-colors">
                  Xong
                </button>
              </div>
            </div>
          )}
      </div>
    </Modal>
  )
}
