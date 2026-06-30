// ============================================
// AI SDK Helper - Creates ZAI instance from env vars
// Falls back to file-based config in sandbox
// ============================================
import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'

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
export async function createAI(): Promise<ZAI> {
  // ZAI.create() is the only supported entry point — it reads its configuration
  // from the Z.ai sandbox config file (or environment) internally. The SDK's
  // constructor is private, so there is no config-passing fallback.
  return await ZAI.create()
}
