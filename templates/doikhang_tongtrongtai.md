import { useState, useEffect } from 'react';
import { Clock, RotateCcw, Play, Pause } from 'lucide-react';

type Fighter = {
  name: string;
  avatar: string;
  score: number;
  yellowCards: number;
};

type Judge = {
  id: number;
  name: string;
  isReady: boolean;
};

export default function App() {
  const [redFighter, setRedFighter] = useState<Fighter>({
    name: 'Trần Văn An',
    avatar: 'T',
    score: 0,
    yellowCards: 0,
  });

  const [blueFighter, setBlueFighter] = useState<Fighter>({
    name: 'Nguyễn Văn An',
    avatar: 'N',
    score: 0,
    yellowCards: 0,
  });

  const [round, setRound] = useState(1);
  const [time, setTime] = useState(180); // 3 minutes in seconds
  const [isRunning, setIsRunning] = useState(false);
  const [knockoutWinner, setKnockoutWinner] = useState<'red' | 'blue' | null>(null);

  const [judges, setJudges] = useState<Judge[]>([
    { id: 1, name: 'Trọng tài Nguyễn Văn A', isReady: false },
    { id: 2, name: 'Trọng tài Trần Thị B', isReady: false },
    { id: 3, name: 'trongtai1', isReady: false },
    { id: 4, name: 'trongtai2', isReady: false },
    { id: 5, name: 'trongtai3', isReady: false },
  ]);

  const [bracketType, setBracketType] = useState('Nam');
  const [ageGroup, setAgeGroup] = useState('12-14 tuổi');
  const [matchNumber, setMatchNumber] = useState(4);
  const [arena, setArena] = useState('Sàn A');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && time > 0) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1);
      }, 1000);
    } else if (time === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, time]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const updateScore = (fighter: 'red' | 'blue', points: number) => {
    if (fighter === 'red') {
      setRedFighter({ ...redFighter, score: Math.max(0, redFighter.score + points) });
    } else {
      setBlueFighter({ ...blueFighter, score: Math.max(0, blueFighter.score + points) });
    }
  };

  const addYellowCard = (fighter: 'red' | 'blue') => {
    if (fighter === 'red') {
      const newCards = redFighter.yellowCards + 1;
      setRedFighter({ 
        ...redFighter, 
        yellowCards: newCards,
        score: newCards % 3 === 0 && newCards > 0 ? Math.max(0, redFighter.score - 1) : redFighter.score
      });
    } else {
      const newCards = blueFighter.yellowCards + 1;
      setBlueFighter({ 
        ...blueFighter, 
        yellowCards: newCards,
        score: newCards % 3 === 0 && newCards > 0 ? Math.max(0, blueFighter.score - 1) : blueFighter.score
      });
    }
  };

  const resetAll = () => {
    setRedFighter({ ...redFighter, score: 0, yellowCards: 0 });
    setBlueFighter({ ...blueFighter, score: 0, yellowCards: 0 });
    setRound(1);
    setTime(180);
    setIsRunning(false);
    setKnockoutWinner(null);
  };

  const nextRound = () => {
    setRound(round + 1);
    setTime(180);
    setIsRunning(false);
  };

  const handleKnockout = (winner: 'red' | 'blue') => {
    setKnockoutWinner(winner);
    setIsRunning(false);
  };

  const toggleJudgeReady = (judgeId: number) => {
    setJudges(judges.map(judge =>
      judge.id === judgeId ? { ...judge, isReady: !judge.isReady } : judge
    ));
  };

  const readyJudgesCount = judges.filter(judge => judge.isReady).length;
  const allJudgesReady = readyJudgesCount === 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto w-full space-y-6">
        {/* Knockout Winner Banner */}
        {knockoutWinner && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className={`${knockoutWinner === 'red' ? 'bg-gradient-to-br from-red-600 to-red-700' : 'bg-gradient-to-br from-blue-600 to-blue-700'} rounded-3xl p-12 shadow-2xl border-4 ${knockoutWinner === 'red' ? 'border-red-400' : 'border-blue-400'} text-center max-w-2xl`}>
              <h1 className="text-white text-7xl font-bold mb-6">KNOCKOUT!</h1>
              <p className="text-white text-4xl font-semibold mb-4">
                {knockoutWinner === 'red' ? 'ĐỎ' : 'XANH'} THẮNG
              </p>
              <p className="text-white text-3xl mb-8">
                {knockoutWinner === 'red' ? redFighter.name : blueFighter.name}
              </p>
              <button
                onClick={() => setKnockoutWinner(null)}
                className="bg-white text-gray-900 px-8 py-4 rounded-xl font-bold text-xl hover:bg-gray-100 transition-all shadow-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {/* Header - Bracket Info and Match Number */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-gray-200">
          <div className="flex items-center justify-between">
            {/* Left Side - Bracket Type */}
            <div className="flex items-center gap-3">
              <p className="text-blue-600 font-semibold text-base">Nhánh đấu:</p>
              <div className="flex gap-2">
                <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full font-semibold text-sm">
                  {bracketType}
                </span>
                <span className="bg-green-100 text-green-600 px-4 py-2 rounded-full font-semibold text-sm">
                  {ageGroup}
                </span>
              </div>
            </div>

            {/* Right Side - Match Number */}
            <div className="bg-white border-2 border-gray-300 px-6 py-3 rounded-full shadow-sm">
              <p className="text-blue-600 font-bold text-lg">
                Trận Số {matchNumber} - {arena}
              </p>
            </div>
          </div>
        </div>

        {/* Top Section - Fighter Cards and Timer */}
        <div className="grid grid-cols-3 gap-4">
          {/* Red Fighter */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-gray-200">
            <div className="text-center">
              <p className="text-red-600 text-sm mb-6 uppercase tracking-wider font-bold">ĐỎ</p>
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="bg-red-100 rounded-2xl p-6 w-28 h-28 flex items-center justify-center border-2 border-red-200 shadow">
                  <span className="text-red-600 text-6xl font-bold">{redFighter.avatar}</span>
                </div>
                <div className="text-red-600 text-9xl font-bold leading-none">{redFighter.score}</div>
              </div>
              <p className="text-gray-800 text-xl font-semibold mb-4">{redFighter.name}</p>

              {/* Yellow Cards Display */}
              <div className="flex gap-2 justify-center min-h-[40px] items-center">
                {[...Array(redFighter.yellowCards)].map((_, i) => (
                  <div key={i} className="bg-yellow-400 w-7 h-9 rounded-md shadow-lg"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Timer and Round */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-gray-200 flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className="text-gray-600" size={20} />
              <span className="text-gray-600 text-base uppercase tracking-wide font-semibold">ĐỒNG HỒ — HIỆP {round}</span>
            </div>
            <div className="text-center text-gray-800 text-7xl font-bold mb-6">{formatTime(time)}</div>
            <div className="grid grid-cols-2 gap-3 w-full mb-3">
              <button
                onClick={() => setIsRunning(!isRunning)}
                disabled={!allJudgesReady && !isRunning}
                className={`${
                  !allJudgesReady && !isRunning
                    ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                } px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow`}
              >
                {isRunning ? (
                  <>
                    <Pause size={18} /> Dừng
                  </>
                ) : (
                  <>
                    <Play size={18} /> Start
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setTime(180);
                  setIsRunning(false);
                }}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow"
              >
                <RotateCcw size={18} /> Reset Timer
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={nextRound}
                className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow"
              >
                Hiệp tiếp theo
              </button>
              <button
                onClick={resetAll}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow"
              >
                Reset tất cả
              </button>
            </div>
          </div>

          {/* Blue Fighter */}
          <div className="bg-white rounded-3xl p-8 shadow-lg border-2 border-gray-200">
            <div className="text-center">
              <p className="text-blue-600 text-sm mb-6 uppercase tracking-wider font-bold">XANH</p>
              <div className="flex items-center justify-center gap-6 mb-6">
                <div className="text-blue-600 text-9xl font-bold leading-none">{blueFighter.score}</div>
                <div className="bg-blue-100 rounded-2xl p-6 w-28 h-28 flex items-center justify-center border-2 border-blue-200 shadow">
                  <span className="text-blue-600 text-6xl font-bold">{blueFighter.avatar}</span>
                </div>
              </div>
              <p className="text-gray-800 text-xl font-semibold mb-4">{blueFighter.name}</p>

              {/* Yellow Cards Display */}
              <div className="flex gap-2 justify-center min-h-[40px] items-center">
                {[...Array(blueFighter.yellowCards)].map((_, i) => (
                  <div key={i} className="bg-yellow-400 w-7 h-9 rounded-md shadow-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section - Scoring Buttons */}
        <div className="grid grid-cols-3 gap-4">
          {/* Red Fighter Scoring */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-red-600 text-base uppercase tracking-wider font-bold mb-3">ĐỎ - CHẤM ĐIỂM</p>
            </div>

            {/* Grid 2x2 Scoring */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateScore('red', 1)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                +1
              </button>
              <button
                onClick={() => updateScore('red', 2)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                +2
              </button>
              <button
                onClick={() => updateScore('red', -1)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                -1
              </button>
              <button
                onClick={() => updateScore('red', -2)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                -2
              </button>
            </div>

            {/* Card Management and Knockout */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => addYellowCard('red')}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow border-2 border-yellow-500"
              >
                + Thẻ Vàng
              </button>
              <button
                onClick={() => handleKnockout('red')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all shadow border-2 border-orange-600"
              >
                Knockout
              </button>
            </div>
          </div>

          {/* Center Controls - Judge Status */}
          <div className="flex flex-col items-center justify-center gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 w-full">
              <p className="text-blue-600 text-sm font-semibold mb-2">Trạng thái</p>
              <p className="text-orange-600 text-2xl font-bold mb-4">
                {allJudgesReady ? 'Sẵn sàng bắt đầu' : 'Chờ trọng tài sẵn sàng'}
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-orange-600 font-bold text-center">
                  {allJudgesReady ? 'Đủ 5/5 trọng tài' : `Chờ ${5 - readyJudgesCount}/5 trọng tài`}
                </p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-600 font-semibold">Sẵn sàng {readyJudgesCount}/5</span>
                <span className="text-blue-600 font-semibold">Đã xác nhận {readyJudgesCount}/5</span>
              </div>
            </div>
          </div>

          {/* Blue Fighter Scoring */}
          <div className="space-y-3">
            <div className="text-center">
              <p className="text-blue-600 text-base uppercase tracking-wider font-bold mb-3">XANH - CHẤM ĐIỂM</p>
            </div>

            {/* Grid 2x2 Scoring */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => updateScore('blue', 1)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                +1
              </button>
              <button
                onClick={() => updateScore('blue', 2)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                +2
              </button>
              <button
                onClick={() => updateScore('blue', -1)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                -1
              </button>
              <button
                onClick={() => updateScore('blue', -2)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-lg hover:shadow-xl aspect-square flex items-center justify-center"
              >
                -2
              </button>
            </div>

            {/* Card Management and Knockout */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => addYellowCard('blue')}
                className="bg-yellow-400 hover:bg-yellow-500 text-yellow-950 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow border-2 border-yellow-500"
              >
                + Thẻ Vàng
              </button>
              <button
                onClick={() => handleKnockout('blue')}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all shadow border-2 border-orange-600"
              >
                Knockout
              </button>
            </div>
          </div>
        </div>

        {/* Judges Section */}
        <div className="bg-white rounded-3xl p-6 shadow-lg border-2 border-gray-200">
          <div className="grid grid-cols-5 gap-4">
            {judges.map((judge) => (
              <div
                key={judge.id}
                className={`rounded-2xl p-4 border-2 transition-all ${
                  judge.isReady
                    ? 'bg-green-50 border-green-400'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <p className="text-blue-600 font-semibold text-sm">Ghế {judge.id}</p>
                  <p className={`text-xs font-semibold ${judge.isReady ? 'text-green-600' : 'text-gray-500'}`}>
                    {judge.isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                  </p>
                </div>
                <p className="text-orange-600 font-bold mb-4 text-center">{judge.name}</p>
                <hr className="border-gray-300 mb-4" />
                <button
                  onClick={() => toggleJudgeReady(judge.id)}
                  className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow ${
                    judge.isReady
                      ? 'bg-green-500 hover:bg-green-600 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {judge.isReady ? 'Hủy' : 'Chấm'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
