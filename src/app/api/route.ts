import { NextResponse } from 'next/server'

// Root API route — minimal health check (no auth required, no sensitive data)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'InvenSync API',
    version: '1.0.0',
  })
}
