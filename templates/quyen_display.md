 <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 text-slate-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-6xl font-bold mb-8 text-center text-slate-800">
          BẢNG CHẤM ĐIỂM VOVINAM
        </h1>

        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-8">
          {/* Header Info */}
          {matchInfo && (
            <div className="bg-[rgb(59,130,246)] bg-opacity-50 rounded-2xl p-6">
              <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-left max-w-4xl mx-auto">
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Nội dung</p>
                  <p className="text-2xl font-bold text-white">{matchInfo.content}</p>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Vận động viên</p>
                  <p className="text-2xl font-bold text-white">{matchInfo.athleteName}</p>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Đơn vị</p>
                  <p className="text-2xl font-bold text-white">{matchInfo.unit}</p>
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-1">Nhánh thi đấu</p>
                  <p className="text-2xl font-bold text-white">{matchInfo.category}</p>
                </div>
              </div>
            </div>
          )}

          {/* Timer */}
          <div>
            <motion.div
              className={`text-9xl font-bold tabular-nums px-12 py-6 rounded-2xl text-center ${
                timeLeft <= 10 && timeLeft > 0
                  ? "bg-orange-500 bg-opacity-80 text-white animate-pulse"
                  : timeLeft === 0
                  ? "bg-slate-700 bg-opacity-80 text-white"
                  : "bg-[rgb(59,130,246)] bg-opacity-50 text-white"
              }`}
              animate={timeLeft <= 10 && timeLeft > 0 ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {formatTime(timeLeft)}
            </motion.div>
          </div>

          {/* Scores Grid */}
          <div className="grid grid-cols-5 gap-6">
            {judges.map((judge) => {
              const score = scores[judge.id];
              return (
                <motion.div
                  key={judge.id}
                  className={`rounded-2xl p-6 text-center ${
                    score
                      ? "bg-emerald-500 bg-opacity-80 text-white"
                      : "bg-[rgb(59,130,246)] bg-opacity-50"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: parseInt(judge.id) * 0.1 }}
                >
                  <p className="text-lg font-semibold mb-4 text-white">
                    {score?.judge || judge.name}
                  </p>
                  <div className={`text-7xl font-bold tabular-nums ${score ? "text-white" : "text-white opacity-60"}`}>
                    {score ? score.score.toFixed(2) : "-"}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Total Score */}
          {totalScore !== null && (
            <motion.div
              className="bg-gradient-to-r from-blue-500 to-cyan-500 bg-opacity-80 rounded-2xl p-12 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <p className="text-3xl font-bold text-white mb-4">TỔNG ĐIỂM</p>
              <div className="text-9xl font-bold text-white tabular-nums drop-shadow-lg">
                {totalScore.toFixed(2)}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>