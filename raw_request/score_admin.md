import { useState, useEffect } from 'react';
import { Clock, RotateCcw, Play, Pause, ArrowRight } from 'lucide-react';

type Fighter = {
  name: string;
  avatar: string;
  score: number;
  yellowCards: number;
};

type MatchPhase = 'selection' | 'active' | 'result';

// ============= COMPONENTS =============

interface MatchSelectionScreenProps {
  bracketId: string;
  setBracketId: (id: string) => void;
  matchNumber: string;
  setMatchNumber: (num: string) => void;
  redFighter: Fighter;
  setRedFighter: (fighter: Fighter) => void;
  blueFighter: Fighter;
  setBlueFighter: (fighter: Fighter) => void;
  onStartMatch: () => void;
}

const MatchSelectionScreen = ({
  bracketId,
  setBracketId,
  matchNumber,
  setMatchNumber,
  redFighter,
  setRedFighter,
  blueFighter,
  setBlueFighter,
  onStartMatch,
}: MatchSelectionScreenProps) => {
  return (
    <div className="max-w-4xl w-full">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-2">VÀO TRẬN ĐẤU</h1>
        <p className="text-gray-400 text-lg">Chọn ngoại hạng và điền thông tin đấu thủ</p>
      </div>

      <div className="space-y-8">
        {/* Bracket & Match Selection */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-2xl p-6 border-2 border-gray-700 shadow-lg">
            <label className="block text-white text-sm font-bold mb-3 uppercase tracking-wider">Ngoại Hạng</label>
            <input
              type="text"
              value={bracketId}
              onChange={(e) => setBracketId(e.target.value)}
              placeholder="VD: NHA-2024-001"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border-2 border-gray-600 focus:border-blue-500 outline-none text-lg font-semibold placeholder-gray-500"
            />
          </div>
          
          <div className="bg-gray-800 rounded-2xl p-6 border-2 border-gray-700 shadow-lg">
            <label className="block text-white text-sm font-bold mb-3 uppercase tracking-wider">Trận Số</label>
            <input
              type="text"
              value={matchNumber}
              onChange={(e) => setMatchNumber(e.target.value)}
              placeholder="VD: M-001"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg border-2 border-gray-600 focus:border-blue-500 outline-none text-lg font-semibold placeholder-gray-500"
            />
          </div>
        </div>

        {/* Fighter Selection */}
        <div className="grid grid-cols-2 gap-6">
          {/* Red Fighter */}
          <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-2xl p-8 border-4 border-red-600 shadow-lg">
            <h2 className="text-red-200 text-sm font-bold uppercase tracking-wider mb-4">Đấu Thủ ĐỎ</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-red-100 text-xs font-bold mb-2 uppercase tracking-wider">Tên Đấu Thủ</label>
                <input
                  type="text"
                  value={redFighter.name}
                  onChange={(e) => setRedFighter({ ...redFighter, name: e.target.value })}
                  placeholder="Nhập tên"
                  className="w-full bg-red-950 text-white px-4 py-3 rounded-lg border-2 border-red-700 focus:border-red-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label className="block text-red-100 text-xs font-bold mb-2 uppercase tracking-wider">Avatar (Ký Tự)</label>
                <input
                  type="text"
                  maxLength={1}
                  value={redFighter.avatar}
                  onChange={(e) => setRedFighter({ ...redFighter, avatar: e.target.value.toUpperCase() })}
                  placeholder="A"
                  className="w-full bg-red-950 text-white px-4 py-3 rounded-lg border-2 border-red-700 focus:border-red-500 outline-none font-bold text-center text-2xl"
                />
              </div>
            </div>
            <div className="mt-6 bg-red-950/50 rounded-lg p-4 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-4xl font-bold text-white">{redFighter.avatar}</span>
              </div>
            </div>
          </div>

          {/* Blue Fighter */}
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-2xl p-8 border-4 border-blue-600 shadow-lg">
            <h2 className="text-blue-200 text-sm font-bold uppercase tracking-wider mb-4">Đấu Thủ XANH</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-blue-100 text-xs font-bold mb-2 uppercase tracking-wider">Tên Đấu Thủ</label>
                <input
                  type="text"
                  value={blueFighter.name}
                  onChange={(e) => setBlueFighter({ ...blueFighter, name: e.target.value })}
                  placeholder="Nhập tên"
                  className="w-full bg-blue-950 text-white px-4 py-3 rounded-lg border-2 border-blue-700 focus:border-blue-500 outline-none font-semibold"
                />
              </div>
              <div>
                <label className="block text-blue-100 text-xs font-bold mb-2 uppercase tracking-wider">Avatar (Ký Tự)</label>
                <input
                  type="text"
                  maxLength={1}
                  value={blueFighter.avatar}
                  onChange={(e) => setBlueFighter({ ...blueFighter, avatar: e.target.value.toUpperCase() })}
                  placeholder="B"
                  className="w-full bg-blue-950 text-white px-4 py-3 rounded-lg border-2 border-blue-700 focus:border-blue-500 outline-none font-bold text-center text-2xl"
                />
              </div>
            </div>
            <div className="mt-6 bg-blue-950/50 rounded-lg p-4 text-center">
              <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center mx-auto">
                <span className="text-4xl font-bold text-white">{blueFighter.avatar}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Match Summary */}
        {bracketId && matchNumber && (
          <div className="bg-gray-800 rounded-2xl p-6 border-2 border-gray-700 shadow-lg">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Ngoại Hạng</p>
                <p className="text-white text-xl font-bold">{bracketId}</p>
              </div>
              <div>
                <ArrowRight className="mx-auto text-gray-500 mb-2" size={24} />
              </div>
              <div>
                <p className="text-gray-400 text-sm uppercase tracking-wider mb-2">Trận</p>
                <p className="text-white text-xl font-bold">{matchNumber}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button
            disabled={!bracketId || !matchNumber || !redFighter.name || !blueFighter.name}
            onClick={onStartMatch}
            className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Play size={20} /> BẮT ĐẦU TRẬN
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-800 hover:to-gray-700 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg"
          >
            Huỷ bỏ
          </button>
        </div>
      </div>
    </div>
  );
};

interface ActiveMatchScreenProps {
  bracketId: string;
  matchNumber: string;
  redFighter: Fighter;
  setRedFighter: (fighter: Fighter) => void;
  blueFighter: Fighter;
  setBlueFighter: (fighter: Fighter) => void;
  round: number;
  setRound: (round: number) => void;
  time: number;
  setTime: (time: number) => void;
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  knockoutWinner: 'red' | 'blue' | null;
  setKnockoutWinner: (winner: 'red' | 'blue' | null) => void;
  handleKnockout: (winner: 'red' | 'blue') => void;
  updateScore: (fighter: 'red' | 'blue', points: number) => void;
  addYellowCard: (fighter: 'red' | 'blue') => void;
  resetAll: () => void;
  nextRound: () => void;
  onExitMatch: () => void;
}

const ActiveMatchScreen = ({
  bracketId,
  matchNumber,
  redFighter,
  setRedFighter,
  blueFighter,
  setBlueFighter,
  round,
  setRound,
  time,
  setTime,
  isRunning,
  setIsRunning,
  knockoutWinner,
  setKnockoutWinner,
  handleKnockout,
  updateScore,
  addYellowCard,
  resetAll,
  nextRound,
  onExitMatch,
}: ActiveMatchScreenProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && time > 0) {
      interval = setInterval(() => {
        setTime(time - 1);
      }, 1000);
    } else if (time === 0) {
      setIsRunning(false);
    }
    return () => clearInterval(interval);
  }, [isRunning, time, setTime, setIsRunning]);

  return (
    <div className="max-w-7xl w-full space-y-6">
      {/* Match Header */}
      <div className="bg-gray-800 rounded-2xl p-4 border-2 border-gray-700 flex items-center justify-between">
        <div className="text-white">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Ngoại Hạng • Trận</p>
          <p className="text-lg font-bold">{bracketId} — {matchNumber}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Hiệp</p>
          <p className="text-3xl font-bold text-white">{round}</p>
        </div>
        <button
          onClick={onExitMatch}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all"
        >
          Thoát
        </button>
      </div>

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

      {/* Top Section - Fighter Cards and Timer */}
      <div className="grid grid-cols-3 gap-4">
        {/* Red Fighter */}
        <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-3xl p-8 shadow-2xl border-4 border-red-500">
          <div className="text-center">
            <p className="text-red-100 text-sm mb-6 uppercase tracking-wider font-bold">ĐỎ</p>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 w-28 h-28 flex items-center justify-center border-4 border-white/40 shadow-lg">
                <span className="text-white text-6xl font-bold">{redFighter.avatar}</span>
              </div>
              <div className="text-white text-9xl font-bold leading-none">{redFighter.score}</div>
            </div>
            <p className="text-white text-xl font-semibold mb-4">{redFighter.name}</p>
            
            {/* Yellow Cards Display */}
            <div className="flex gap-2 justify-center min-h-[40px] items-center">
              {[...Array(redFighter.yellowCards)].map((_, i) => (
                <div key={i} className="bg-yellow-400 w-7 h-9 rounded-md shadow-lg"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Timer and Round */}
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-3xl p-8 shadow-2xl border-4 border-gray-600 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Clock className="text-gray-300" size={20} />
            <span className="text-gray-300 text-base uppercase tracking-wide font-semibold">ĐỒNG HỒ — HIỆP {round}</span>
          </div>
          <div className="text-center text-white text-7xl font-bold mb-6">{formatTime(time)}</div>
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
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
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <RotateCcw size={18} /> Reset
            </button>
          </div>
        </div>

        {/* Blue Fighter */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl p-8 shadow-2xl border-4 border-blue-500">
          <div className="text-center">
            <p className="text-blue-100 text-sm mb-6 uppercase tracking-wider font-bold">XANH</p>
            <div className="flex items-center justify-center gap-6 mb-6">
              <div className="text-white text-9xl font-bold leading-none">{blueFighter.score}</div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 w-28 h-28 flex items-center justify-center border-4 border-white/40 shadow-lg">
                <span className="text-white text-6xl font-bold">{blueFighter.avatar}</span>
              </div>
            </div>
            <p className="text-white text-xl font-semibold mb-4">{blueFighter.name}</p>
            
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
            <p className="text-red-400 text-base uppercase tracking-wider font-bold mb-3">ĐỎ - CHẤM ĐIỂM</p>
          </div>
          
          {/* Grid 2x2 Scoring */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateScore('red', 1)}
              className="bg-gradient-to-br from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              +1
            </button>
            <button
              onClick={() => updateScore('red', 2)}
              className="bg-gradient-to-br from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              +2
            </button>
            <button
              onClick={() => updateScore('red', -1)}
              className="bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              -1
            </button>
            <button
              onClick={() => updateScore('red', -2)}
              className="bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              -2
            </button>
          </div>

          {/* Card Management and Knockout */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => addYellowCard('red')}
              className="bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-yellow-950 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-lg border-2 border-yellow-400"
            >
              + Thẻ Vàng
            </button>
            <button
              onClick={() => handleKnockout('red')}
              className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-lg border-2 border-orange-400"
            >
              Knockout
            </button>
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex flex-col items-center justify-center gap-4">
          {/* Control Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={nextRound}
              className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg"
            >
              Hiệp tiếp theo
            </button>
            <button
              onClick={resetAll}
              className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg"
            >
              Reset tất cả
            </button>
          </div>
        </div>

        {/* Blue Fighter Scoring */}
        <div className="space-y-3">
          <div className="text-center">
            <p className="text-blue-400 text-base uppercase tracking-wider font-bold mb-3">XANH - CHẤM ĐIỂM</p>
          </div>
          
          {/* Grid 2x2 Scoring */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => updateScore('blue', 1)}
              className="bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              +1
            </button>
            <button
              onClick={() => updateScore('blue', 2)}
              className="bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              +2
            </button>
            <button
              onClick={() => updateScore('blue', -1)}
              className="bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              -1
            </button>
            <button
              onClick={() => updateScore('blue', -2)}
              className="bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-8 rounded-2xl font-bold text-4xl transition-all shadow-xl hover:shadow-2xl aspect-square flex items-center justify-center"
            >
              -2
            </button>
          </div>

          {/* Card Management and Knockout */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => addYellowCard('blue')}
              className="bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-yellow-950 px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-lg border-2 border-yellow-400"
            >
              + Thẻ Vàng
            </button>
            <button
              onClick={() => handleKnockout('blue')}
              className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-all shadow-lg border-2 border-orange-400"
            >
              Knockout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
  
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
  const [bracketId, setBracketId] = useState<string>('');
  const [matchNumber, setMatchNumber] = useState<string>('');

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

  const startMatch = () => {
    if (bracketId && matchNumber && redFighter.name && blueFighter.name) {
      setMatchPhase('active');
      setRound(1);
      setTime(180);
      setIsRunning(false);
      setRedFighter({ ...redFighter, score: 0, yellowCards: 0 });
      setBlueFighter({ ...blueFighter, score: 0, yellowCards: 0 });
      setKnockoutWinner(null);
    }
  };

  const exitMatch = () => {
    setMatchPhase('selection');
    setBracketId('');
    setMatchNumber('');
    setRedFighter({ ...redFighter, score: 0, yellowCards: 0 });
    setBlueFighter({ ...blueFighter, score: 0, yellowCards: 0 });
    setRound(1);
    setTime(180);
    setIsRunning(false);
    setKnockoutWinner(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 flex items-center justify-center">
      {matchPhase === 'selection' && (
        <MatchSelectionScreen
          bracketId={bracketId}
          setBracketId={setBracketId}
          matchNumber={matchNumber}
          setMatchNumber={setMatchNumber}
          redFighter={redFighter}
          setRedFighter={setRedFighter}
          blueFighter={blueFighter}
          setBlueFighter={setBlueFighter}
          onStartMatch={startMatch}
        />
      )}

      {matchPhase === 'active' && (
        <ActiveMatchScreen
          bracketId={bracketId}
          matchNumber={matchNumber}
          redFighter={redFighter}
          setRedFighter={setRedFighter}
          blueFighter={blueFighter}
          setBlueFighter={setBlueFighter}
          round={round}
          setRound={setRound}
          time={time}
          setTime={setTime}
          isRunning={isRunning}
          setIsRunning={setIsRunning}
          knockoutWinner={knockoutWinner}
          setKnockoutWinner={setKnockoutWinner}
          handleKnockout={handleKnockout}
          updateScore={updateScore}
          addYellowCard={addYellowCard}
          resetAll={resetAll}
          nextRound={nextRound}
          onExitMatch={exitMatch}
        />
      )}
    </div>
  );
}
