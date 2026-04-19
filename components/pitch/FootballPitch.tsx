'use client'

import React from 'react'

type Slot = { id: string; x: number; y: number; role: string }   // x/y are 0-100 percent
type Placement = { slotId: string; playerId: string; playerName: string; avatarUrl?: string | null }

type Props = {
  slots: Slot[]
  placements: Placement[]
  selectedSlot: string | null
  onSlotClick: (slotId: string) => void
  onPlacementClick?: (playerId: string) => void
  /** Name printed on the back of each shirt chip when a player is placed. */
  numberByPlayerId?: Record<string, number>
}

export function FootballPitch({ slots, placements, selectedSlot, onSlotClick, onPlacementClick, numberByPlayerId }: Props) {
  // SVG coordinate space: 100 wide × 150 tall (portrait pitch)
  const W = 100, H = 150
  const byPlayerSlot = Object.fromEntries(placements.map(p => [p.slotId, p]))

  return (
    <div className="relative w-full max-w-md mx-auto aspect-[2/3]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full rounded-2xl shadow-lg"
        style={{ background: 'linear-gradient(180deg, #0c8a3e 0%, #0a7e37 50%, #0c8a3e 100%)' }}
      >
        {/* Stripe pattern */}
        <defs>
          <pattern id="stripes" x="0" y="0" width={W} height="15" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width={W} height="7.5" fill="rgba(255,255,255,0.03)" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#stripes)" />

        {/* Outer touchlines */}
        <rect x="2" y="2" width={W - 4} height={H - 4} fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />

        {/* Half-way line */}
        <line x1="2" y1={H / 2} x2={W - 2} y2={H / 2} stroke="white" strokeWidth="0.4" opacity="0.85" />

        {/* Centre circle */}
        <circle cx={W / 2} cy={H / 2} r="9" fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />
        <circle cx={W / 2} cy={H / 2} r="0.6" fill="white" opacity="0.85" />

        {/* Top penalty area (opponents) */}
        <rect x="25" y="2" width="50" height="16" fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />
        <rect x="37" y="2" width="26" height="6" fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />
        <circle cx="50" cy="14" r="0.6" fill="white" opacity="0.85" />
        <path d={`M 40 18 A 10 10 0 0 0 60 18`} fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />

        {/* Bottom penalty area (home) */}
        <rect x="25" y={H - 18} width="50" height="16" fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />
        <rect x="37" y={H - 8} width="26" height="6" fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />
        <circle cx="50" cy={H - 14} r="0.6" fill="white" opacity="0.85" />
        <path d={`M 40 ${H - 18} A 10 10 0 0 1 60 ${H - 18}`} fill="none" stroke="white" strokeWidth="0.4" opacity="0.85" />

        {/* Corners */}
        {[[2, 2], [W - 2, 2], [2, H - 2], [W - 2, H - 2]].map(([cx, cy], i) => (
          <path
            key={i}
            d={`M ${cx} ${cy} m 0 ${cy < H / 2 ? 1.8 : -1.8} a 1.8 1.8 0 ${cx < W / 2 ? 0 : 1} ${cy < H / 2 ? 0 : 1} ${cx < W / 2 ? 1.8 : -1.8} ${cy < H / 2 ? -1.8 : 1.8}`}
            fill="none" stroke="white" strokeWidth="0.4" opacity="0.85"
          />
        ))}

        {/* Slots */}
        {slots.map(slot => {
          const placed = byPlayerSlot[slot.id]
          const selected = selectedSlot === slot.id
          const cx = slot.x
          const cy = slot.y

          if (placed) {
            const initials = placed.playerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            const num = numberByPlayerId?.[placed.playerId]
            return (
              <g
                key={slot.id}
                onClick={() => onPlacementClick?.(placed.playerId)}
                style={{ cursor: onPlacementClick ? 'pointer' : 'default' }}
              >
                {/* Chip */}
                <circle
                  cx={cx} cy={cy} r="5"
                  fill={selected ? '#f97316' : '#003087'}
                  stroke="white"
                  strokeWidth="0.6"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
                />
                <text
                  x={cx} y={cy + 1.4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="3.5"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {num ?? initials}
                </text>
                {/* Name label */}
                <text
                  x={cx} y={cy + 9}
                  textAnchor="middle"
                  fill="white"
                  fontSize="2.3"
                  fontWeight="600"
                  fontFamily="system-ui, sans-serif"
                  style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))' }}
                >
                  {placed.playerName.split(' ').slice(-1)[0]}
                </text>
                {/* Role tag */}
                <text
                  x={cx} y={cy + 11.7}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize="1.6"
                  fontWeight="500"
                  fontFamily="system-ui, sans-serif"
                >
                  {slot.role}
                </text>
              </g>
            )
          }

          return (
            <g key={slot.id} onClick={() => onSlotClick(slot.id)} style={{ cursor: 'pointer' }}>
              <circle
                cx={cx} cy={cy} r="5"
                fill={selected ? 'rgba(249,115,22,0.9)' : 'rgba(255,255,255,0.18)'}
                stroke={selected ? 'white' : 'rgba(255,255,255,0.6)'}
                strokeWidth="0.5"
                strokeDasharray={selected ? '0' : '1 1'}
                className={selected ? 'animate-pulse' : ''}
              />
              <text
                x={cx} y={cy + 1}
                textAnchor="middle"
                fill="white"
                fontSize="2.8"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
                opacity="0.95"
              >
                {slot.role}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
