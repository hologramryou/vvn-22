import { ImageWithFallback } from './figma/ImageWithFallback';

interface AthleteCardProps {
  athleteName: string;
  club: string;
  category: string;
  weightClass: string;
  birthYear: number;
  photoUrl?: string;
}

export function AthleteCard({ 
  athleteName, 
  club,
  category,
  weightClass,
  birthYear,
  photoUrl 
}: AthleteCardProps) {
  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-full max-w-lg bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-2xl overflow-hidden border border-blue-100">
      {/* Tournament Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 px-8 py-6 text-center relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-700 rounded-full opacity-20 -translate-x-16 -translate-y-16"></div>
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-blue-700 rounded-full opacity-20 translate-x-12 translate-y-12"></div>
        
        <h1 className="text-white text-2xl font-bold tracking-wide relative z-10">
          GIẢI VOVINAM
        </h1>
        <h1 className="text-yellow-400 text-2xl font-bold tracking-wide relative z-10">
          LƯƠNG TÀI MỞ RỘNG 2026
        </h1>
      </div>

      {/* Header Section with Avatar */}
      <div className="bg-gradient-to-b from-[#1e3a5f] to-[#2d5a8f] px-8 py-12 text-center relative">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-5">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1" fill="white" />
            </pattern>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>

        {/* Avatar - Centered and Larger */}
        <div className="flex justify-center mb-6 relative z-10">
          <div className="relative">
            <div className="w-52 h-52 rounded-full bg-white flex items-center justify-center shadow-2xl ring-8 ring-blue-400/30">
              {photoUrl ? (
                <ImageWithFallback 
                  src={photoUrl}
                  alt={athleteName}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <span className="text-[#1e3a5f] text-6xl font-bold">
                  {getInitials(athleteName)}
                </span>
              )}
            </div>
            {/* Decorative ring */}
            <div className="absolute -inset-2 rounded-full border-4 border-yellow-400/40 animate-pulse"></div>
          </div>
        </div>
        
        {/* Name */}
        <h2 className="text-white text-4xl font-bold mb-4 relative z-10 tracking-wide">
          {athleteName}
        </h2>
        <div className="inline-block bg-white/20 backdrop-blur-sm px-6 py-2 rounded-full relative z-10">
          <p className="text-yellow-300 text-lg font-semibold">
            {club}
          </p>
        </div>
      </div>

      {/* Information Section */}
      <div className="p-8">
        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-1 w-8 bg-gradient-to-r from-transparent to-blue-600 rounded-full"></div>
            <h3 className="font-bold text-xl text-gray-800">THÔNG TIN THI ĐẤU</h3>
            <div className="h-1 w-8 bg-gradient-to-l from-transparent to-blue-600 rounded-full"></div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-xl p-5 shadow-md border border-blue-100 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-base">Năm sinh</span>
              <span className="font-bold text-gray-900 text-lg">{birthYear}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-md border border-blue-100 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-base">Hạng mục thi đấu</span>
              <span className="font-bold text-gray-900 text-lg">{category}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-md border border-blue-100 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-base">Hạng cân thi đấu</span>
              <span className="font-bold text-gray-900 text-lg">{weightClass}</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center">
              <span className="text-blue-100 text-base">Nội dung thi đấu</span>
              <span className="font-bold text-white text-lg">Đối kháng</span>
            </div>
          </div>
        </div>

        {/* Footer decoration */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-600"></div>
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          <div className="w-2 h-2 rounded-full bg-blue-300"></div>
        </div>
      </div>
    </div>
  );
}