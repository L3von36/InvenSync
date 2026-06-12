'use client'

import { Package, RefreshCw, Home, AlertCircle } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log the error details to console only — never expose to the user
  console.error('[InvenSync Global Error]', {
    message: error.message,
    digest: error.digest,
    stack: error.stack,
  })

  return (
    <html lang="en">
      <head>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
              'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
        `}</style>
      </head>
      <body style={{ backgroundColor: '#faf9f7', color: '#1c1917' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          {/* InvenSync Branding */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#f97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.25)',
              }}
            >
              <Package size={22} color="white" strokeWidth={2} />
            </div>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                color: '#1c1917',
              }}
            >
              InvenSync
            </span>
          </div>

          {/* Error Icon */}
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '24px',
            }}
          >
            <AlertCircle size={36} color="#ef4444" strokeWidth={2} />
          </div>

          {/* Error Content */}
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#1c1917',
              marginBottom: '8px',
              textAlign: 'center',
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: '#78716c',
              maxWidth: '420px',
              textAlign: 'center',
              lineHeight: '1.6',
              marginBottom: '32px',
            }}
          >
            We encountered an unexpected error. Our team has been notified and
            we&apos;re working to fix it.
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 20px',
                borderRadius: '8px',
                backgroundColor: '#f97316',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'background-color 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#ea580c'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#f97316'
              }}
            >
              <RefreshCw size={16} />
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '40px',
                padding: '0 20px',
                borderRadius: '8px',
                backgroundColor: 'white',
                color: '#1c1917',
                fontSize: '14px',
                fontWeight: 500,
                border: '1px solid #e7e5e4',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'background-color 0.15s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f4'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white'
              }}
            >
              <Home size={16} />
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
