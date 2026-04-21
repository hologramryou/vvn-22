import { Trophy } from 'lucide-react';
import { useState } from 'react';

type MatchStatus = 'pending' | 'ongoing' | 'completed';
type Winner = 'team1' | 'team2' | null;

interface Match {
  team1: string;
  team2: string;
  status: MatchStatus;
  winner: Winner;
}

export function TournamentBracket() {
  const [athletes, setAthletes] = useState({
    // Round of 32 - 16 matches
    round1: Array(16).fill(null).map((_, i) => ({
      team1: `VĐV ${i * 2 + 1}`,
      team2: `VĐV ${i * 2 + 2}`,
      status: 'pending' as MatchStatus,
      winner: null as Winner
    })),
    // Round of 16 - 8 matches
    round2: Array(8).fill(null).map(() => ({ 
      team1: '', 
      team2: '', 
      status: 'pending' as MatchStatus,
      winner: null as Winner
    })),
    // Quarter-finals - 4 matches
    round3: Array(4).fill(null).map(() => ({ 
      team1: '', 
      team2: '', 
      status: 'pending' as MatchStatus,
      winner: null as Winner
    })),
    // Semi-finals - 2 matches
    round4: Array(2).fill(null).map(() => ({ 
      team1: '', 
      team2: '', 
      status: 'pending' as MatchStatus,
      winner: null as Winner
    })),
    // Final - 1 match
    round5: [{
      team1: '', 
      team2: '', 
      status: 'pending' as MatchStatus,
      winner: null as Winner
    }],
  });

  const updateAthlete = (round: keyof typeof athletes, matchIndex: number, team: 'team1' | 'team2', value: string) => {
    setAthletes(prev => ({
      ...prev,
      [round]: prev[round].map((match, i) => 
        i === matchIndex ? { ...match, [team]: value } : match
      )
    }));
  };

  const cycleStatus = (round: keyof typeof athletes, matchIndex: number) => {
    setAthletes(prev => ({
      ...prev,
      [round]: prev[round].map((match, i) => {
        if (i === matchIndex) {
          const statuses: MatchStatus[] = ['pending', 'ongoing', 'completed'];
          const currentIndex = statuses.indexOf(match.status);
          const nextStatus = statuses[(currentIndex + 1) % 3];
          return { ...match, status: nextStatus };
        }
        return match;
      })
    }));
  };

  const setWinner = (round: keyof typeof athletes, matchIndex: number, winner: Winner) => {
    setAthletes(prev => ({
      ...prev,
      [round]: prev[round].map((match, i) => 
        i === matchIndex ? { ...match, winner, status: 'completed' as MatchStatus } : match
      )
    }));
  };

  const getStatusColor = (status: MatchStatus) => {
    switch (status) {
      case 'pending': return 'bg-gray-200';
      case 'ongoing': return 'bg-blue-500';
      case 'completed': return 'bg-green-500';
    }
  };

  const getStatusText = (status: MatchStatus) => {
    switch (status) {
      case 'pending': return 'Chưa đấu';
      case 'ongoing': return 'Đang đấu';
      case 'completed': return 'Hoàn thành';
    }
  };

  const MatchBox = ({ 
    match, 
    round, 
    index,
    roundOffset = 0
  }: { 
    match: Match; 
    round: keyof typeof athletes; 
    index: number;
    roundOffset?: number;
  }) => {
    const matchNumber = roundOffset + index + 1;
    
    return (
      <div className="border border-gray-400 bg-white shadow-sm">
        {/* Status Bar */}
        <div 
          className={`${getStatusColor(match.status)} px-2 py-0.5 flex items-center justify-between cursor-pointer`}
          onClick={() => cycleStatus(round, index)}
        >
          <span className="text-[9px] text-white font-medium">#{matchNumber}</span>
          <span className="text-[9px] text-white font-medium">{getStatusText(match.status)}</span>
        </div>
        
        {/* Teams */}
        <div className="p-1.5 space-y-0.5">
          <div 
            className={`flex items-center px-1.5 py-1 border ${
              match.winner === 'team1' ? 'bg-blue-500 border-blue-600' : 'bg-gray-50 border-gray-300'
            } cursor-pointer`}
            onClick={() => setWinner(round, index, match.winner === 'team1' ? null : 'team1')}
          >
            <input
              type="text"
              value={match.team1}
              onChange={(e) => updateAthlete(round, index, 'team1', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 bg-transparent text-[11px] outline-none ${
                match.winner === 'team1' ? 'text-white font-semibold' : 'text-gray-800'
              }`}
              placeholder="VĐV 1"
            />
            {match.winner === 'team1' && <span className="text-white text-xs ml-1">✓</span>}
          </div>
          
          <div 
            className={`flex items-center px-1.5 py-1 border ${
              match.winner === 'team2' ? 'bg-blue-500 border-blue-600' : 'bg-gray-50 border-gray-300'
            } cursor-pointer`}
            onClick={() => setWinner(round, index, match.winner === 'team2' ? null : 'team2')}
          >
            <input
              type="text"
              value={match.team2}
              onChange={(e) => updateAthlete(round, index, 'team2', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className={`flex-1 bg-transparent text-[11px] outline-none ${
                match.winner === 'team2' ? 'text-white font-semibold' : 'text-gray-800'
              }`}
              placeholder="VĐV 2"
            />
            {match.winner === 'team2' && <span className="text-white text-xs ml-1">✓</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 bg-white px-8 py-2 border-2 border-blue-500">
          <h1 className="text-xl font-bold text-blue-900">GIẢI ĐẤU VOVINAM</h1>
        </div>
        <p className="text-blue-700 text-sm font-medium mt-1">Đối Kháng - 32 VĐV</p>
      </div>

      {/* Tournament Bracket */}
      <div className="max-w-[1600px] mx-auto overflow-x-auto pb-4">
        <svg className="absolute w-0 h-0">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="2.5"
              orient="auto"
            >
              <path d="M0,0 L0,5 L7,2.5 z" fill="#3B82F6" />
            </marker>
          </defs>
        </svg>

        {/* Top Half */}
        <div className="grid grid-cols-[140px_40px_140px_40px_140px_40px_140px_40px_160px_40px_140px_40px_140px_40px_140px_40px_140px] gap-2 items-center mb-8">
          
          {/* Round 1 Left - Top 4 */}
          <div className="space-y-2">
            {athletes.round1.slice(0, 4).map((match, i) => (
              <MatchBox key={i} match={match} round="round1" index={i} roundOffset={0} />
            ))}
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1="0" y1={35 + i * 70} x2="20" y2={35 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={35 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="0" y1={70 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={52.5 + i * 70} x2="40" y2={52.5 + i * 70} stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                </g>
              ))}
            </svg>
          </div>

          {/* Round 2 Left - Top 2 */}
          <div className="space-y-2">
            {athletes.round2.slice(0, 2).map((match, i) => (
              <div key={i} style={{ marginTop: i === 0 ? '35px' : '0' }}>
                <MatchBox match={match} round="round2" index={i} roundOffset={0} />
              </div>
            ))}
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="0" y1="70" x2="20" y2="70" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="70" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="140" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="105" x2="40" y2="105" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </svg>
          </div>

          {/* Round 3 Left - Top 1 */}
          <div className="space-y-2">
            <div style={{ marginTop: '87px' }}>
              <MatchBox match={athletes.round3[0]} round="round3" index={0} roundOffset={0} />
            </div>
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="0" y1="105" x2="20" y2="105" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="105" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="122.5" x2="40" y2="122.5" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </svg>
          </div>

          {/* Round 4 Semi Top */}
          <div className="space-y-2">
            <div style={{ marginTop: '105px' }}>
              <MatchBox match={athletes.round4[0]} round="round4" index={0} roundOffset={0} />
            </div>
          </div>

          {/* Lines to Center */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="0" y1="122.5" x2="40" y2="122.5" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </svg>
          </div>

          {/* Center - Final */}
          <div className="flex flex-col items-center justify-center">
            <div className="bg-white border-2 border-blue-600 p-2">
              <div className="flex flex-col items-center mb-2">
                <Trophy className="w-10 h-10 text-yellow-500" strokeWidth={2} />
                <h2 className="text-xs font-bold text-blue-900 mt-1">CHUNG KẾT</h2>
              </div>
              <MatchBox match={athletes.round5[0]} round="round5" index={0} roundOffset={0} />
            </div>
          </div>

          {/* Lines from Center */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="0" y1="122.5" x2="40" y2="122.5" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
              <line x1="0" y1="157.5" x2="40" y2="157.5" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </svg>
          </div>

          {/* Round 4 Semi Bottom */}
          <div className="space-y-2">
            <div style={{ marginTop: '140px' }}>
              <MatchBox match={athletes.round4[1]} round="round4" index={1} roundOffset={0} />
            </div>
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="40" y1="157.5" x2="20" y2="157.5" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="140" x2="20" y2="157.5" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="140" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Round 3 Right - Top 1 */}
          <div className="space-y-2">
            <div style={{ marginTop: '87px' }}>
              <MatchBox match={athletes.round3[1]} round="round3" index={1} roundOffset={0} />
            </div>
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="40" y1="105" x2="20" y2="105" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="70" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="70" x2="20" y2="70" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="140" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Round 2 Right - Top 2 */}
          <div className="space-y-2">
            {athletes.round2.slice(2, 4).map((match, i) => (
              <div key={i + 2} style={{ marginTop: i === 0 ? '35px' : '0' }}>
                <MatchBox match={match} round="round2" index={i + 2} roundOffset={0} />
              </div>
            ))}
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1="40" y1={35 + i * 70} x2="20" y2={35 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={35 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="40" y1={70 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={52.5 + i * 70} x2="0" y2={52.5 + i * 70} stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                </g>
              ))}
            </svg>
          </div>

          {/* Round 1 Right - Top 4 */}
          <div className="space-y-2">
            {athletes.round1.slice(4, 8).map((match, i) => (
              <MatchBox key={i + 4} match={match} round="round1" index={i + 4} roundOffset={0} />
            ))}
          </div>
        </div>

        {/* Bottom Half */}
        <div className="grid grid-cols-[140px_40px_140px_40px_140px_40px_140px_40px_160px_40px_140px_40px_140px_40px_140px_40px_140px] gap-2 items-center">
          
          {/* Round 1 Left - Bottom 4 */}
          <div className="space-y-2">
            {athletes.round1.slice(8, 12).map((match, i) => (
              <MatchBox key={i + 8} match={match} round="round1" index={i + 8} roundOffset={0} />
            ))}
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1="0" y1={35 + i * 70} x2="20" y2={35 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={35 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="0" y1={70 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={52.5 + i * 70} x2="40" y2={52.5 + i * 70} stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                </g>
              ))}
            </svg>
          </div>

          {/* Round 2 Left - Bottom 2 */}
          <div className="space-y-2">
            {athletes.round2.slice(4, 6).map((match, i) => (
              <div key={i + 4} style={{ marginTop: i === 0 ? '35px' : '0' }}>
                <MatchBox match={match} round="round2" index={i + 4} roundOffset={0} />
              </div>
            ))}
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="0" y1="70" x2="20" y2="70" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="70" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="140" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="105" x2="40" y2="105" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </svg>
          </div>

          {/* Round 3 Left - Bottom 1 */}
          <div className="space-y-2">
            <div style={{ marginTop: '87px' }}>
              <MatchBox match={athletes.round3[2]} round="round3" index={2} roundOffset={0} />
            </div>
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="0" y1="105" x2="20" y2="105" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="105" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="122.5" x2="40" y2="122.5" stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
            </svg>
          </div>

          {/* Empty Space */}
          <div></div>
          <div></div>

          {/* Empty Center */}
          <div></div>

          {/* Empty */}
          <div></div>
          <div></div>

          {/* Round 4 - Empty */}
          <div></div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="40" y1="122.5" x2="20" y2="122.5" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="105" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="105" x2="20" y2="105" stroke="#3B82F6" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Round 3 Right - Bottom 1 */}
          <div className="space-y-2">
            <div style={{ marginTop: '87px' }}>
              <MatchBox match={athletes.round3[3]} round="round3" index={3} roundOffset={0} />
            </div>
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              <line x1="40" y1="105" x2="20" y2="105" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="20" y1="70" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="70" x2="20" y2="70" stroke="#3B82F6" strokeWidth="1.5" />
              <line x1="0" y1="140" x2="20" y2="140" stroke="#3B82F6" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Round 2 Right - Bottom 2 */}
          <div className="space-y-2">
            {athletes.round2.slice(6, 8).map((match, i) => (
              <div key={i + 6} style={{ marginTop: i === 0 ? '35px' : '0' }}>
                <MatchBox match={match} round="round2" index={i + 6} roundOffset={0} />
              </div>
            ))}
          </div>

          {/* Lines */}
          <div className="relative h-[280px]">
            <svg className="w-full h-full">
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line x1="40" y1={35 + i * 70} x2="20" y2={35 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={35 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="40" y1={70 + i * 70} x2="20" y2={70 + i * 70} stroke="#3B82F6" strokeWidth="1.5" />
                  <line x1="20" y1={52.5 + i * 70} x2="0" y2={52.5 + i * 70} stroke="#3B82F6" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
                </g>
              ))}
            </svg>
          </div>

          {/* Round 1 Right - Bottom 4 */}
          <div className="space-y-2">
            {athletes.round1.slice(12, 16).map((match, i) => (
              <MatchBox key={i + 12} match={match} round="round1" index={i + 12} roundOffset={0} />
            ))}
          </div>
        </div>
      </div>

      {/* Round Labels */}
      <div className="max-w-[1600px] mx-auto mt-6">
        <div className="grid grid-cols-5 gap-8 text-center">
          <div><span className="bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">Vòng 1/32 (16 trận)</span></div>
          <div><span className="bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">Vòng 1/16 (8 trận)</span></div>
          <div><span className="bg-blue-600 text-white px-3 py-1 text-xs font-bold">Tứ Kết (4) & Bán Kết (2) & Chung Kết (1)</span></div>
          <div><span className="bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">Vòng 1/16 (8 trận)</span></div>
          <div><span className="bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">Vòng 1/32 (16 trận)</span></div>
        </div>
      </div>
    </div>
  );
}