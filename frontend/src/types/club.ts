export interface Club {
  id: number
  code: string
  name: string
  description: string | null
  province_id: number
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  founded_date: string | null
  status: string
  tournament_ids: number[]
  coach_name: string | null
  coach_phone: string | null
  caretaker_name: string | null
  caretaker_phone: string | null
  member_count: number
  created_at: string | null
  updated_at: string | null
}

export interface ClubListResponse {
  items: Club[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Province {
  id: number
  name: string
  code: string
}

export interface ClubFormData {
  name: string
  description: string
  province_id: number | ''
  founded_date: string
  address: string
  phone: string
  email: string
  logo_url: string
  tournament_ids: number[]
  coach_name: string
  coach_phone: string
  caretaker_name: string
  caretaker_phone: string
}
