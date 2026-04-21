export interface StudentListItem {
  id: number
  code: string
  full_name: string
  club_id: number | null
  club_name: string | null
  current_belt: string
  weight_class: number | null
  weight_classes: number[] | null
  compete_events: string[] | null
  quyen_selections: string[] | null
  category_type: string | null
  category_loai: string | null
  status: string
  weight_verified: boolean
  avatar_url?: string | null
  // Dynamic tournament registration display fields
  registration_category?: string | null           // Hạng mục = Node level-1 name
  registration_weight_class_name?: string | null  // Hạng cân = leaf node name (sparring only)
  registration_content?: string[] | null          // Nội dung thi đấu = weight class + katas
}

export interface StudentListResponse {
  items: StudentListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface Club {
  id: number
  name: string
}

export interface ClubHistory {
  club_name: string
  joined_at: string
  left_at: string | null
  is_current: boolean
}

export interface StudentDetail {
  id: number; code: string; full_name: string
  date_of_birth: string; gender: string
  id_number: string | null
  phone: string | null; email: string | null; address: string | null
  avatar_url: string | null; current_belt: string
  belt_date: string | null; join_date: string | null
  weight_class: number | null
  weight_classes: number[] | null
  compete_events: string[] | null
  quyen_selections: string[] | null
  category_type: string | null
  category_loai: string | null
  notes: string | null; status: string
  weight_verified: boolean
  club_id: number | null; club_name: string | null
  club_address: string | null; coach_name: string | null
  coach_phone: string | null; club_joined_at: string | null
  club_history: ClubHistory[]
}

export interface StudentCardData {
  id: number
  code: string
  full_name: string
  avatar_url: string | null
  date_of_birth: string | null
  gender: string
  weight_class: number | null
  compete_events: string[] | null
  category_type: string | null
  category_loai: string | null
  club_name: string | null
  status: string
  registration_category?: string | null
  registration_weight_class_name?: string | null
  registration_content?: string[] | null
}

export interface StudentFilters {
  keyword: string
  club_id: string
  belt_rank: string
  event: string
  page: number
}
