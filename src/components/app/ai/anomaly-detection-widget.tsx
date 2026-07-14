'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  RefreshCw,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore } from '@/lib/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'

// ============================================
// Types
// ============================================
interface Anomaly {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  title: string
  description: string
  affectedEntity: string
  entityId?: string
  recommendation: string
  detectedAt: string
}

interface AnomalyDetectionResult {
  anomalies: Anomaly[]
  source: 'ai' | 'rule-based'
  analyzedAt: string
}

// ============================================
// Severity Config
// ============================================
const severityConfig = {
  critical: {
    color: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    icon: ShieldAlert,
    iconColor: 'text-red-600 dark:text-red-400',
    badgeVariant: 'destructive' as const,
    label: 'Critical',
  },
  high: {
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
    icon: AlertTriangle,
    iconColor: 'text-orange-600 dark:text-orange-400',
    badgeVariant: 'default' as const,
    label: 'High',
  },
  medium: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: AlertCircle,
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    badgeVariant: 'secondary' as const,
    label: 'Medium',
  },
  low: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Info,
    iconColor: 'text-blue-600 dark:text-blue-400',
    badgeVariant: 'outline' as const,
    label: 'Low',
  },
}

// ============================================
// Anomaly Card Component
// ============================================
function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const [expanded, setExpanded] = useState(false)
  const config = severityConfig[anomaly.severity]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`${config.border} overflow-hidden`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`size-9 rounded-full ${config.color} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className={`size-4 ${config.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="font-semibold text-sm">{anomaly.title}</h4>
                <Badge variant={config.badgeVariant} className="text-[0.769rem] px-1.5 py-0">
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {anomaly.description}
              </p>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 space-y-2">
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Affected Entity</span>
                        <p className="text-sm flex items-center gap-1">
                          {anomaly.affectedEntity}
                          {anomaly.entityId && (
                            <ExternalLink className="size-3 text-muted-foreground" />
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Type</span>
                        <p className="text-sm capitalize">{anomaly.type.replace(/_/g, ' ')}</p>
                      </div>
                      <Separator />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Recommendation</span>
                        <p className="text-sm">{anomaly.recommendation}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                {expanded ? (
                  <>Less detail <ChevronUp className="size-3" /></>
                ) : (
                  <>More detail <ChevronDown className="size-3" /></>
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Anomaly Detection Widget
// ============================================
export function AnomalyDetectionWidget() {
  const { currentOrg } = useAuthStore()
  const setPage = useAppStore((s) => s.setPage)
  const [result, setResult] = useState<AnomalyDetectionResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runAnalysis = useCallback(async () => {
    if (!currentOrg || isLoading) return

    setIsLoading(true)
    try {
      const data = await api.detectAnomalies(currentOrg.id) as unknown as AnomalyDetectionResult
      setResult(data)
      toast.success(`Found ${data.anomalies.length} anomalies`, {
        description: `Analysis powered by ${data.source === 'ai' ? 'AI' : 'rule-based engine'}`,
      })
    } catch (err) {
      const message = getNetworkErrorMessage(err)
      toast.error('Analysis failed', { description: message })
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, isLoading])

  // Severity counts
  const severityCounts = result?.anomalies.reduce(
    (acc, a) => {
      acc[a.severity] = (acc[a.severity] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  ) || {}

  // Sort anomalies by severity
  const sortedAnomalies = result?.anomalies.slice().sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 }
    return order[a.severity] - order[b.severity]
  }) || []

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" />
            Anomaly Detection
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            AI-powered detection of unusual patterns in your business data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className="text-xs text-muted-foreground">
              Last: {formatTimestamp(result.analyzedAt)}
            </span>
          )}
          <Button
            onClick={runAnalysis}
            disabled={isLoading || !currentOrg}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin mr-1" />
            ) : (
              <Sparkles className="size-4 mr-1" />
            )}
            {isLoading ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
      </div>

      {/* Empty State */}
      {!result && !isLoading && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ShieldAlert className="size-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No Analysis Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Run an analysis to detect anomalies in your stock levels, sales patterns, and revenue data.
            </p>
            <Button
              onClick={runAnalysis}
              disabled={!currentOrg}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Sparkles className="size-4 mr-1" />
              Run First Analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results */}
      {result && !isLoading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
              const config = severityConfig[severity]
              const Icon = config.icon
              const count = severityCounts[severity] || 0
              return (
                <Card key={severity} className={`${count > 0 ? config.border : 'border-dashed'}`}>
                  <CardContent className="p-3 flex items-center gap-2">
                    <Icon className={`size-4 ${config.iconColor}`} />
                    <div>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[0.769rem] text-muted-foreground capitalize">{severity}</p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Source badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[0.769rem]">
              {result.source === 'ai' ? '✨ AI-Powered' : '📊 Rule-Based'}
            </Badge>
          </div>

          {/* Anomaly Cards */}
          {sortedAnomalies.length === 0 ? (
            <Card>
              <CardContent className="py-8 flex flex-col items-center text-center">
                <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-3">
                  <ShieldAlert className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-green-700 dark:text-green-400">No Anomalies Detected</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your business data looks healthy. No unusual patterns were found.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {sortedAnomalies.map((anomaly) => (
                <AnomalyCard key={anomaly.id} anomaly={anomaly} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
