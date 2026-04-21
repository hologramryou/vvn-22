import { Trophy } from 'lucide-react'

export const NoTournamentGuard = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-400">
    <Trophy size={48} className="opacity-30" />
    <p className="text-base font-medium text-gray-500">Vui lòng chọn giải đấu</p>
    <p className="text-sm text-gray-400">Chọn một giải đấu từ thanh bên trái để xem dữ liệu</p>
  </div>
)
