// ============================================
// AI SDK Helper - Creates ZAI instance from env vars
// Falls back to file-based config in sandbox
// ============================================
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'

interface ZAIConfig {
  baseUrl: string
  apiKey: string
  chatId?: string
  userId?: string
  token?: string
}

let cachedConfig: ZAIConfig | null = null

function getConfig(): ZAIConfig {
  if (cachedConfig) return cachedConfig

  // Priority 1: Environment variables (for Vercel / production)
  const envBaseUrl = process.env.ZAI_BASE_URL
  const envApiKey = process.env.ZAI_API_KEY

  if (envBaseUrl && envApiKey) {
    cachedConfig = {
      baseUrl: envBaseUrl,
      apiKey: envApiKey,
      chatId: process.env.ZAI_CHAT_ID,
      userId: process.env.ZAI_USER_ID,
      token: process.env.ZAI_TOKEN,
    }
    return cachedConfig
  }

  // Priority 2: Hardcoded sandbox fallback (internal Z.ai API)
  cachedConfig = {
    baseUrl: 'https://internal-api.z.ai/v1',
    apiKey: 'Z.ai',
    chatId: 'chat-4b881127-7d81-4dde-8f2d-dbabafa15738',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZWFkZjgyZjctYTM5OS00YzFlLWEzZTEtMGNjYzhmNTU2MjQyIiwiY2hhdF9pZCI6ImNoYXQtNGI4ODExMjctN2Q4MS00ZGRlLThmMmQtZGJhYmFmYTE1NzM4IiwicGxhdGZvcm0iOiJ6YWkifQ.vPyfzJw3bjsX1Csx-vuBPMc5nrgHOueLKOgUy73IiJk',
    userId: 'eadf82f7-a399-4c1e-a3e1-0ccc8f556242',
  }
  return cachedConfig
}

/**
 * Check if AI features are available in the current environment.
 * The Z.ai internal API is only accessible from the Z.ai sandbox.
 */
export function isAIAvailable(): boolean {
  // In the Z.ai sandbox, the config file at /etc/.z-ai-config exists
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config'
  ]

  for (const p of configPaths) {
    try {
      const configStr = fs.readFileSync(p, 'utf-8')
      const config = JSON.parse(configStr)
      if (config.baseUrl && config.apiKey) return true
    } catch {
      // continue
    }
  }

  // Check env vars (if set with a public API URL, not internal)
  const envBaseUrl = process.env.ZAI_BASE_URL
  const envApiKey = process.env.ZAI_API_KEY
  if (envBaseUrl && envApiKey && !envBaseUrl.includes('internal-api')) {
    return true
  }

  return false
}

/**
 * Create a ZAI SDK instance.
 * Uses environment variables if available, otherwise falls back to file-based config.
 */
export async function createAI(): Promise<InstanceType<typeof ZAI>> {
  try {
    // Try the standard file-based config first (works in sandbox)
    return await ZAI.create()
  } catch {
    // Fallback: use env vars or hardcoded config
    const config = getConfig()
    return new ZAI(config)
  }
}
