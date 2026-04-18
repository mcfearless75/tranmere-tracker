'use client'

import { useEffect, useState } from 'react'

export function SplashScreen() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Only show once per session
    if (sessionStorage.getItem('splash_shown')) {
      setVisible(false)
      return
    }
    const fadeTimer = setTimeout(() => setFading(true), 2500)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem('splash_shown', '1')
    }, 3200)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-tranmere-blue flex flex-col items-center justify-center transition-opacity duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className={`flex flex-col items-center gap-4 transition-all duration-700 ${
          fading ? 'scale-110 opacity-0' : 'scale-100 opacity-100'
        }`}
        style={{ animation: 'splashZoom 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://upload.wikimedia.org/wikipedia/en/thumb/5/55/Tranmere_Rovers_FC_crest.svg/960px-Tranmere_Rovers_FC_crest.svg.png"
          alt="Tranmere Rovers"
          className="w-32 h-32 object-contain drop-shadow-2xl"
        />
        <div className="text-center">
          <p className="text-white text-2xl font-bold tracking-wide">Tranmere Tracker</p>
          <p className="text-white/60 text-sm mt-1">Loading…</p>
        </div>
      </div>
      <style>{`
        @keyframes splashZoom {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
