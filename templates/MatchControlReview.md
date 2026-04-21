export default function MatchControlReview() {
  const judges = [
    { seat: 1, name: 'Trọng Tài A', state: 'Chờ', score: null },
    { seat: 2, name: 'Trọng Tài A', state: 'Chờ', score: null },
    { seat: 3, name: 'Trọng Tài A', state: 'Chờ', score: null },
    { seat: 4, name: 'Trọng Tài A', state: 'Chờ', score: null },
    { seat: 5, name: 'Trọng Tài A', state: 'Chờ', score: null },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-slate-600">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <header className="rounded-2xl bg-white p-5 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Số thứ tự 1 · Sàn A</div>
            <div className="text-4xl font-bold text-orange-600">A1</div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
            <div>Bài 1</div>
            <div>Nam 12–14</div>
            <div>120 giây</div>
            <div>Màn hình Display</div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">

          {/* LEFT */}
          <div className="space-y-6">

            {/* CONTROL */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-400">Trạng thái</div>
                  <div className="text-2xl font-semibold text-slate-700">Chưa bắt đầu</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-slate-400">Thời gian</div>
                  <div className="text-xl font-semibold text-slate-700">120 giây</div>
                </div>
              </div>

              <div className="mt-4 flex gap-3">
                <button className="flex-1 h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700">
                  Bắt đầu
                </button>

                <button className="flex-1 h-12 rounded-xl bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300">
                  Màn hình Display
                </button>
              </div>

              <div className="mt-4 flex gap-6 text-sm text-slate-500">
                <div>Sẵn sàng 0/5</div>
                <div>Đã xác nhận 0/5</div>
              </div>
            </div>

            {/* JUDGES */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {judges.map((j) => (
                  <div key={j.seat} className="rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-700">Ghế {j.seat}</div>
                      <div className="text-xs text-amber-500">{j.state}</div>
                    </div>

                    <div className="mt-3 text-lg font-semibold text-blue-700">
                      Trọng tài: {j.name}
                    </div>

                    <div className="mt-2 text-xl font-bold text-slate-800">
                      {j.score ?? '--'}
                    </div>

                    <button className="mt-3 w-full h-10 rounded-lg bg-white border border-slate-300 text-sm text-slate-700 hover:bg-slate-100">
                      Chấm điểm
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT */}
          <div className="space-y-6">

            {/* RESULT */}
            <div className="rounded-2xl bg-white p-5 shadow-sm text-center">
              <div className="text-sm text-slate-400">Điểm</div>
              <div className="text-6xl font-bold text-blue-700 mt-2">--</div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div className="bg-slate-50 p-3 rounded-lg text-slate-600">Tổng</div>
                <div className="bg-slate-50 p-3 rounded-lg text-slate-600">Cao</div>
                <div className="bg-slate-50 p-3 rounded-lg text-slate-600">Thấp</div>
              </div>
            </div>

            {/* STEPS */}
            <div className="rounded-2xl bg-white p-5 shadow-sm space-y-2 text-sm">
              <div className="text-green-600">1. Trọng tài sẵn sàng</div>
              <div className="text-slate-500">2. Bắt đầu</div>
              <div className="text-slate-500">3. Nhận điểm</div>
              <div className="text-slate-500">4. Chốt kết quả</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
