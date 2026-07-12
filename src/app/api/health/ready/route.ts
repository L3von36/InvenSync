// Readiness probe — answers "can this deployment serve traffic?"
// Checks the database connection; returns 503 so load balancers and
// deploy checks can hold traffic until dependencies are reachable.
import { NextResponse } from 'next/server'
import { db } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  let dbOk = false
  try {
    await db.$queryRaw`SELECT 1`
    dbOk = true
  } catch {
    dbOk = false
  }

  const ready = dbOk
  return NextResponse.json(
    {
      status: ready ? 'ok' : 'degraded',
      db: dbOk,
      latencyMs: Date.now() - start,
      ts: Date.now(),
    },
    {
      status: ready ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  )
}
