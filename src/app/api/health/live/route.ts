// Liveness probe — answers "is the process running?" without touching
// any dependency. Used by uptime monitors that just need a heartbeat.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ status: 'ok', ts: Date.now() })
}
