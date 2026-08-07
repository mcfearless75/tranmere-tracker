'use client'

// Global error boundary — replaces the root layout, so Tailwind CSS is not
// available here. Inline styles only.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f9fafb' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '100%',
              textAlign: 'center',
            }}
          >
            <h1 style={{ color: '#003087', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
              Something went wrong
            </h1>
            <p style={{ color: '#6b7280', fontSize: 14, margin: '0 0 20px' }}>
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              style={{
                background: '#003087',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
