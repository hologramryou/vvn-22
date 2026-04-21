import { useState } from 'react'

interface AthleteCardProps {
  athleteName: string
  club?: string
  category?: string
  weightClass?: string
  content?: string[]
  birthYear?: number
  competitionType?: string
  photoUrl?: string
  tournamentName?: string
  athleteCode?: string
}

function splitTournamentName(name: string): [string, string] {
  const m = name.match(/^(giải\s+vovinam)(.*)/i)
  if (m) return ['GIẢI VOVINAM', m[2].trim().toUpperCase()]
  return [name.toUpperCase(), '']
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.substring(0, 2).toUpperCase()
}

// Card: 360 × 590 px
// Header 68px | Avatar 302px | Info 220px
export function AthleteCard({
  athleteName,
  club,
  category,
  weightClass,
  content,
  birthYear,
  competitionType,
  photoUrl,
  tournamentName = 'Giải Vovinam Lương Tài Mở Rộng 2026',
  athleteCode,
}: AthleteCardProps) {
  const [imgError, setImgError] = useState(false)
  const showInitials = !photoUrl || imgError
  const [titleLine1, titleLine2] = splitTournamentName(tournamentName)

  return (
    <div style={{
      width: 360,
      height: 590,
      display: 'flex',
      flexDirection: 'column',
      background: '#f0f4ff',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #bfdbfe',
      boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
    }}>

      {/* ── Header 68px ─────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        height: 68,
        background: 'linear-gradient(135deg, #0f2461 0%, #1a3a8f 50%, #0f2461 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        gap: 2,
      }}>
        <div style={{ position: 'absolute', top: -24, left: -24, width: 64, height: 64, borderRadius: '50%', background: 'rgba(96,130,220,0.25)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: -20, width: 56, height: 56, borderRadius: '50%', background: 'rgba(96,130,220,0.25)' }} />
        <span style={{ color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '0.12em', lineHeight: 1, position: 'relative', zIndex: 1 }}>
          {titleLine1}
        </span>
        {titleLine2 && (
          <span style={{ color: '#facc15', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', lineHeight: 1, position: 'relative', zIndex: 1 }}>
            {titleLine2}
          </span>
        )}
      </div>

      {/* ── Avatar section 302px ─────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        height: 302,
        background: 'linear-gradient(180deg, #1e3a5f 0%, #2d5a8f 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 45,
        paddingBottom: 16,
        paddingLeft: 20,
        paddingRight: 20,
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* dot pattern */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          opacity: 0.06,
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }} />

        {/* Avatar circle */}
        <div style={{ position: 'relative', flexShrink: 0, zIndex: 1 }}>
          {/* gold ring */}
          <div style={{
            position: 'absolute',
            top: -5, left: -5, right: -5, bottom: -5,
            borderRadius: '50%',
            border: '3px solid rgba(250,204,21,0.55)',
          }} />
          <div style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: '#fff',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3), 0 0 0 5px rgba(96,165,250,0.28)',
            position: 'relative',
            zIndex: 1,
          }}>
            {showInitials ? (
              <span style={{ color: '#1e3a5f', fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
                {getInitials(athleteName)}
              </span>
            ) : (
              <img
                src={photoUrl}
                alt={athleteName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setImgError(true)}
                crossOrigin="anonymous"
              />
            )}
          </div>
        </div>

        {/* Name */}
        <div style={{ marginTop: 14, zIndex: 1, textAlign: 'center', width: '100%', flexShrink: 0 }}>
          <span style={{
            color: '#fff',
            fontWeight: 800,
            fontSize: 22,
            lineHeight: 1.25,
            display: 'block',
            overflow: 'hidden',
            maxHeight: 56,
          }}>
            {athleteName}
          </span>
        </div>

        {/* Club pill */}
        {club && (
          <div style={{ marginTop: 10, zIndex: 1, textAlign: 'center', width: '100%', flexShrink: 0 }}>
            <span style={{
              display: 'inline-block',
              background: 'rgba(255,255,255,0.18)',
              borderRadius: 999,
              paddingTop: 5,
              paddingBottom: 5,
              paddingLeft: 16,
              paddingRight: 16,
              maxWidth: 280,
            }}>
              <span style={{
                color: '#fde68a',
                fontWeight: 600,
                fontSize: 12,
                lineHeight: '22px',
                display: 'block',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {club}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Info section 220px ───────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        height: 220,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 12px 10px',
        boxSizing: 'border-box',
      }}>

        {/* Section title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, #3b82f6)' }} />
          <span style={{ color: '#374151', fontWeight: 700, fontSize: 9, letterSpacing: '0.1em', lineHeight: 1 }}>
            THÔNG TIN THI ĐẤU
          </span>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, #3b82f6)' }} />
        </div>

        {/* Rows — fixed height, no flex:1 to prevent stretch */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {birthYear && <InfoRow label="Năm sinh" value={String(birthYear)} />}
          {category && <InfoRow label="Hạng mục" value={category} />}
          {weightClass && <InfoRow label="Hạng cân" value={weightClass} />}
          {content && content.length > 0
            ? <InfoRow label="Nội dung thi đấu" value={content.join(' • ')} accent />
            : competitionType && <InfoRow label="Nội dung thi đấu" value={competitionType} accent />}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: 9, lineHeight: 1 }}>
            {athleteCode ?? ''}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60a5fa' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#93c5fd' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  const textStyle: React.CSSProperties = {
    display: 'table-cell',
    verticalAlign: 'middle',
  }
  return (
    <div style={{
      display: 'table',
      width: '100%',
      borderRadius: 8,
      height: 34,
      flexShrink: 0,
      ...(accent
        ? { background: 'linear-gradient(90deg, #2563eb, #1d4ed8)' }
        : { background: '#fff', border: '1px solid #dbeafe', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
      ),
    }}>
      <span style={{
        ...textStyle,
        paddingLeft: 12,
        fontSize: 11,
        color: accent ? 'rgba(219,234,254,0.9)' : '#6b7280',
        whiteSpace: 'nowrap',
        width: '40%',
      }}>
        {label}
      </span>
      <span style={{
        ...textStyle,
        paddingRight: 12,
        fontSize: 12,
        fontWeight: 700,
        color: accent ? '#fff' : '#111827',
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 190,
      }}>
        {value}
      </span>
    </div>
  )
}
