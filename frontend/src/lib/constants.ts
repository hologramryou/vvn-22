// ─── Competition categories ───────────────────────────────────────────────────
export interface CategoryLoai {
  value: string
  label: string
  hint : string
}

export interface CategoryDef {
  type  : string
  label : string
  loaiList: CategoryLoai[]
}

export const CATEGORIES: CategoryDef[] = [
  {
    type : 'phong_trao',
    label: 'Phong trào',
    loaiList: [
      { value: '1A', label: 'Loại 1A', hint: '' },
      { value: '1B', label: 'Loại 1B', hint: '4–6 tuổi' },
      { value: '2',  label: 'Loại 2',  hint: '7–9 tuổi' },
      { value: '3',  label: 'Loại 3',  hint: '10–12 tuổi' },
      { value: '4',  label: 'Loại 4',  hint: '18–25 tuổi (đối kháng)' },
      { value: '5',  label: 'Loại 5',  hint: '18–35 tuổi' },
    ],
  },
  {
    type : 'pho_thong',
    label: 'Phổ thông',
    loaiList: [
      { value: '1', label: 'Loại 1', hint: '' },
      { value: '2', label: 'Loại 2', hint: 'Cấp 2 (lớp 6–9)' },
      { value: '3', label: 'Loại 3', hint: 'Cấp 3 (lớp 10–12)' },
      { value: '4', label: 'Loại 4', hint: '18–25 tuổi (đối kháng) · 18–35 tuổi' },
    ],
  },
]

export const categoryLabel = (type: string, loai: string) => {
  const cat = CATEGORIES.find(c => c.type === type)
  const l   = cat?.loaiList.find(x => x.value === loai)
  if (!cat || !l) return null
  return `${cat.label} – ${l.label}`
}

// ─── Belt ranks ─────────────────────────────────────────────────────────────
export const COMPETING_BELTS = [
  "Tự vệ nhập môn",
  "Lam đai nhập môn",
  "Lam đai I",
  "Lam đai II",
  "Lam đai III",
  "Chuẩn Hoàng đai",
  "Hoàng đai",
  "Hoàng đai I",
  "Hoàng đai II",
  "Hoàng đai III",
  "Chuẩn Hồng đai",
] as const

export type BeltRank = typeof COMPETING_BELTS[number]

export const BELT_STYLE: Record<string, { bg: string; text: string }> = {
  "Tự vệ nhập môn":   { bg: "bg-sky-200",    text: "text-sky-900" },
  "Lam đai nhập môn": { bg: "bg-blue-500",   text: "text-white"   },
  "Lam đai I":        { bg: "bg-blue-500",   text: "text-white"   },
  "Lam đai II":       { bg: "bg-blue-600",   text: "text-white"   },
  "Lam đai III":      { bg: "bg-blue-700",   text: "text-white"   },
  "Chuẩn Hoàng đai":  { bg: "bg-yellow-300", text: "text-yellow-900" },
  "Hoàng đai":        { bg: "bg-yellow-400", text: "text-yellow-900" },
  "Hoàng đai I":      { bg: "bg-yellow-500", text: "text-yellow-900" },
  "Hoàng đai II":     { bg: "bg-yellow-500", text: "text-yellow-900" },
  "Hoàng đai III":    { bg: "bg-yellow-600", text: "text-white"   },
  "Chuẩn Hồng đai":   { bg: "bg-orange-500", text: "text-white"   },
  "Hồng đai I":       { bg: "bg-red-600",    text: "text-white"   },
  "Hồng đai II":      { bg: "bg-red-600",    text: "text-white"   },
  "Hồng đai III":     { bg: "bg-red-700",    text: "text-white"   },
  "Hồng đai IV":      { bg: "bg-red-700",    text: "text-white"   },
  "Hồng đai V":       { bg: "bg-red-800",    text: "text-white"   },
  "Hồng đai VI":      { bg: "bg-red-800",    text: "text-white"   },
  "Bạch đai":         { bg: "bg-white border border-gray-300", text: "text-gray-700" },
}

// ─── Weight classes ──────────────────────────────────────────────────────────
export interface WeightClass {
  label: string
  range: string
  value: number
}

export const WEIGHT_CLASSES: Record<'M' | 'F', WeightClass[]> = {
  M: [
    { label: "45 kg",      range: "Dưới 45 kg",          value: 45  },
    { label: "48 kg",      range: "45 – 48 kg",          value: 48  },
    { label: "51 kg",      range: "48 – 51 kg",          value: 51  },
    { label: "54 kg",      range: "51 – 54 kg",          value: 54  },
    { label: "57 kg",      range: "54 – 57 kg",          value: 57  },
    { label: "60 kg",      range: "57 – 60 kg",          value: 60  },
    { label: "64 kg",      range: "60 – 64 kg",          value: 64  },
    { label: "68 kg",      range: "64 – 68 kg",          value: 68  },
    { label: "72 kg",      range: "68 – 72 kg",          value: 72  },
    { label: "77 kg",      range: "72 – 77 kg",          value: 77  },
    { label: "82 kg",      range: "77 – 82 kg",          value: 82  },
    { label: "92 kg",      range: "82 – 92 kg",          value: 92  },
    { label: "Trên 92 kg", range: "Hạng nặng tuyệt đối", value: 999 },
  ],
  F: [
    { label: "42 kg",      range: "Dưới 42 kg", value: 42  },
    { label: "45 kg",      range: "42 – 45 kg", value: 45  },
    { label: "48 kg",      range: "45 – 48 kg", value: 48  },
    { label: "51 kg",      range: "48 – 51 kg", value: 51  },
    { label: "54 kg",      range: "51 – 54 kg", value: 54  },
    { label: "57 kg",      range: "54 – 57 kg", value: 57  },
    { label: "60 kg",      range: "57 – 60 kg", value: 60  },
    { label: "63 kg",      range: "60 – 63 kg", value: 63  },
    { label: "66 kg",      range: "63 – 66 kg", value: 66  },
    { label: "70 kg",      range: "66 – 70 kg", value: 70  },
    { label: "75 kg",      range: "70 – 75 kg", value: 75  },
    { label: "Trên 75 kg", range: "Hạng nặng",  value: 999 },
  ],
}

// ─── Compete event types ──────────────────────────────────────────────────────
export const COMPETE_OPTIONS = [
  { value: 'sparring',   label: 'Đối kháng' },
  { value: 'don_luyen',  label: 'Đơn luyện' },
  { value: 'song_luyen', label: 'Song luyện' },
  { value: 'da_luyen',   label: 'Đa luyện' },
  { value: 'don_chan',   label: 'Đòn chân' },
]

export const eventLabel = (v: string) =>
  COMPETE_OPTIONS.find(o => o.value === v)?.label ?? v

// ─── Quyền (form techniques) by gender ───────────────────────────────────────
export interface QuyenGroup {
  type: string
  typeLabel: string
  items: string[]
}

export const QUYEN_BY_GENDER: Record<'M' | 'F', QuyenGroup[]> = {
  M: [
    {
      type: 'don_luyen', typeLabel: 'Đơn luyện',
      items: ['Tứ trụ quyền','Ngũ môn quyền','Nhập môn quyền','Xà quyền','Lão mai quyền','Việt võ đạo quyền','Tinh hoa lưỡng nghi kiếm pháp','Thái dương côn pháp'],
    },
    {
      type: 'song_luyen', typeLabel: 'Song luyện',
      items: ['Song luyện nam – tay không','Song luyện nam – binh khí'],
    },
    {
      type: 'da_luyen', typeLabel: 'Đa luyện',
      items: ['Đa luyện vũ khí nam','Đa luyện tay không nam'],
    },
    {
      type: 'don_chan', typeLabel: 'Đòn chân',
      items: ['Đòn chân tấn công nam','Đồng đội kỹ thuật căn bản nam'],
    },
  ],
  F: [
    {
      type: 'don_luyen', typeLabel: 'Đơn luyện',
      items: ['Long hổ quyền','Tinh hoa lưỡng nghi kiếm pháp','Thập thế bát thức quyền','Mai hoa quyền'],
    },
    {
      type: 'song_luyen', typeLabel: 'Song luyện',
      items: ['Song luyện nữ – tay không','Song luyện nữ – binh khí'],
    },
    {
      type: 'da_luyen', typeLabel: 'Đa luyện',
      items: ['Đa luyện vũ khí nữ','Đa luyện tay không nữ'],
    },
    {
      type: 'don_chan', typeLabel: 'Đòn chân',
      items: ['Đòn chân tấn công nữ','Đồng đội kỹ thuật căn bản nữ'],
    },
  ],
}
