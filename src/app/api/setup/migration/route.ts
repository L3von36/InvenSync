import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isDatabaseError } from '@/lib/api-error'

export async function GET() {
  try {
    const sqlPath = join(process.cwd(), 'prisma', 'migration.sql')
    const sql = readFileSync(sqlPath, 'utf-8')
    return NextResponse.json({ sql })
  } catch (error) {
    if (isDatabaseError(error)) {
      return NextResponse.json({ error: 'Service temporarily unavailable. Please try again.' }, { status: 503 })
    }
    return NextResponse.json({ error: 'Failed to read migration SQL' }, { status: 500 })
  }
}
