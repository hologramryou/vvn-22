export default function RefereeSetupSample() {
  const seats = [
    {
      id: 1,
      label: 'Ghế 1',
      refereeName: 'Nguyễn Văn An',
      state: 'assigned',
    },
    {
      id: 2,
      label: 'Ghế 2',
      refereeName: 'Trần Minh Khang',
      state: 'assigned',
    },
    {
      id: 3,
      label: 'Ghế 3',
      refereeName: '',
      state: 'empty',
    },
    {
      id: 4,
      label: 'Ghế 4',
      refereeName: '',
      state: 'empty',
    },
    {
      id: 5,
      label: 'Ghế 5',
      refereeName: '',
      state: 'empty',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F8FF] font-sans text-slate-800 p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[32px] border border-[#D9E6FF] bg-white px-6 py-6 shadow-[0_16px_48px_rgba(37,99,235,0.08)] md:px-8 md:py-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <p className="text-sm font-medium tracking-[0.02em] text-[#3B82F6]">Vận động viên / đội</p>
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#C2410C] md:text-5xl">
                  Hoàng
                </h1>
                <p className="mt-2 text-lg text-slate-500">CLB Vovinam Quận 1</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile label="Nội dung" value="Bài 2" />
              <InfoTile label="Nhánh thi đấu" value="Nam > 12–14 tuổi" />
              <InfoTile label="Thứ tự thi" value="STT #4" />
              <InfoTile label="Thời lượng" value="120 giây" />
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-[#D9E6FF] bg-white px-6 py-6 shadow-[0_16px_48px_rgba(37,99,235,0.08)] md:px-8 md:py-8">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium tracking-[0.18em] text-[#3B82F6]">Cấu hình trọng tài</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#C2410C]">
                Gán trọng tài cho 5 ghế chấm
              </h2>
            </div>

            <span className="inline-flex w-fit items-center rounded-full border border-[#D9E6FF] bg-[#F7FAFF] px-4 py-2 text-sm font-medium text-slate-600">
              Sample giao diện
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {seats.map((seat) => (
              <SeatSampleCard key={seat.id} {...seat} />
            ))}
          </div>

          <div className="mt-8 flex justify-start">
            <button
              type="button"
              className="inline-flex items-center rounded-2xl bg-[#2563EB] px-5 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8]"
            >
              Lưu cấu hình
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function SeatSampleCard({
  label,
  refereeName,
  state,
}: {
  label: string;
  refereeName: string;
  state: 'assigned' | 'empty';
}) {
  const assigned = state === 'assigned';

  return (
    <article
      className={`rounded-[28px] border p-5 transition ${
        assigned
          ? 'border-[#BFDBFE] bg-[#F8FBFF] shadow-[0_12px_30px_rgba(37,99,235,0.08)]'
          : 'border-[#E6EEFF] bg-white'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-[#EAF2FF] px-3 py-1 text-sm font-semibold text-[#2563EB]">
          {label}
        </span>

        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            assigned
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {assigned ? 'Đã gán' : 'Chưa gán'}
        </span>
      </div>

      {assigned ? (
        <div className="mt-5 rounded-[22px] border border-[#DBEAFE] bg-white px-4 py-4">
          <p className="text-sm text-slate-500">Trọng tài</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#C2410C]">
            {refereeName}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-[22px] border border-dashed border-[#D9E6FF] bg-[#FAFCFF] px-4 py-4 text-slate-500">
          <p className="text-sm">Chọn trọng tài</p>
          <p className="mt-2 text-base font-medium text-slate-400">Chưa có account được gán</p>
        </div>
      )}
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#E6EEFF] bg-[#F9FBFF] px-4 py-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-slate-800">{value}</p>
    </div>
  );
}
