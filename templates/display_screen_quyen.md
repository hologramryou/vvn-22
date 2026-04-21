export default function VovinamScoringDisplay() {
  const judges = [
    { seat: 1, name: 'trongtai1', score: 92, status: 'locked' },
    { seat: 2, name: 'trongtai2', score: 91, status: 'locked' },
    { seat: 3, name: 'trongtai3', score: 90, status: 'locked' },
    { seat: 4, name: 'trongtai4', score: 93, status: 'locked' },
    { seat: 5, name: 'trongtai5', score: 91, status: 'locked' },
  ];

  const scores = judges.map((j) => j.score);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const middleScores = sortedScores.slice(1, -1);
  const officialScore = (
    middleScores.reduce((sum, score) => sum + score, 0) / middleScores.length
  ).toFixed(2);
  const completedCount = judges.filter((j) => j.status === 'locked').length;

  return (
    <div className="min-h-screen bg-[#F3F7FF] font-sans p-6 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-start">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium tracking-[0.01em] text-[#3B82F6]">
                Chấm điểm thi đấu quyền
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#C2410C] md:text-5xl">
                CLB Vovinam Bình Thạnh
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm md:text-base">
              <InfoChip label="Nam" />
              <InfoChip label="12–14 tuổi" />
              <InfoChip label="Đồng đội 1" />
            </div>
          </div>

          <section className="rounded-[28px] border border-[#D9E6FF] bg-white/95 p-6 shadow-[0_10px_30px_rgba(37,99,235,0.06)]">
            <p className="text-sm font-medium tracking-[0.01em] text-[#3B82F6]">Trạng thái</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <h2 className="text-[42px] md:text-[48px] font-semibold leading-tight tracking-[-0.02em] text-[#1D4ED8]">
                Đã xác nhận
              </h2>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {completedCount}/{judges.length} trọng tài đã chấm
            </p>
          </section>
        </header>

        <section className="rounded-[36px] border border-[#D9E6FF] bg-white/95 px-6 py-10 shadow-[0_10px_30px_rgba(37,99,235,0.06)] md:px-10 md:py-16">
          <p className="text-center text-sm font-medium tracking-[0.01em] text-[#3B82F6]">
            Điểm chính thức
          </p>
          <div className="mt-6 text-center">
            <p className="text-[120px] font-semibold leading-none tracking-[-0.06em] text-[#16A34A] md:text-[200px]">
              {officialScore}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#9A3412]">Trọng tài</h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {judges.map((judge) => (
              <article
                key={judge.seat}
                className="rounded-[24px] border border-[#D9E6FF] bg-white/95 p-5 shadow-[0_10px_30px_rgba(37,99,235,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(37,99,235,0.10)]"
              >
                <p className="text-sm font-medium tracking-[0.01em] text-[#3B82F6]">
                  Trọng tài {judge.seat}
                </p>
                <h4 className="mt-4 text-[28px] font-semibold leading-tight tracking-[-0.03em] text-[#C2410C]">
                  {judge.name}
                </h4>

                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-[#1D4ED8]">
                      {judge.score}
                    </p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                    Đã xác nhận
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#D9E6FF] bg-white/80 px-3 py-1.5 font-medium text-slate-600 shadow-[0_6px_18px_rgba(37,99,235,0.06)]">
      {label}
    </span>
  );
}
