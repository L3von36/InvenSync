'use client'

import { useState, useCallback } from 'react'
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState } from '@/components/shared/error-states'

// ============================================
// Types
// ============================================
interface Anomaly {
  id: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  description: string
  entity: string
  entityId?: string
  recommendation: string
  detectedAt: string
}

// ============================================
// Severity helpers
// ============================================
const severityConfig = {
  critical: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertTriangle, badge: 'bg-red-500' },
  high: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', icon: AlertCircle, badge: 'bg-orange-500' },
  medium: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Info, badge: 'bg-yellow-500' },
  low: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Info, badge: 'bg-blue-500' },
}

// ============================================
// Anomaly Card Component
// ============================================
function AnomalyCard({ anomaly }: { anomaly: Anomaly }) {
  const [expanded, setExpanded] = useState(false)
  const config = severityConfig[anomaly.severity]
  const Icon = config.icon

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-full p-2 ${config.color}`}>
            <Icon className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{anomaly.title}</h4>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 text-white ${config.badge}`}>
                {anomaly.severity}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{anomaly.description}</p>

            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary mt-2 hover:underline"
            >
              {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              {expanded ? 'Less details' : 'More details'}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2 text-sm">
                <Separator />
                <div>
                  <span className="font-medium">Entity:</span>{' '}
                  <Badge variant="secondary">{anomaly.entity}</Badge>
                </div>
                <div>
                  <span className="font-medium">Recommendation:</span>{' '}
                  <span className="text-muted-foreground">{anomaly.recommendation}</span>
                </div>
                <div>
                  <span className="font-medium">Detected:</span>{' '}
                  <span className="text-muted-foreground">{new Date(anomaly.detectedAt).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Page Component
// ============================================
export function AnomalyDetectionPage() {
  const { currentOrg } = useAuthStore()
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [loading, setLoading] = useState(false)
  const [lastAnalyzed, setLastAnalyzed] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [fetchError, setFetchError] = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    if (!currentOrg) return
    setLoading(true)
    setFetchError(null)
    try {
      const result = await api.post('/api/ai/anomaly-detection', {
        organizationId: currentOrg.id,
      }) as { anomalies: Anomaly[] }
      setAnomalies(result.anomalies || [])
      setLastAnalyzed(new Date().toISOString())
      toast.success(`Analysis complete — ${(result.anomalies || []).length} anomalies found`)
    } catch (error) {
      console.error('Anomaly detection failed', error)
      setFetchError(getNetworkErrorMessage(error))
      toast.error(getNetworkErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [currentOrg])

  const handleRetry = () => {
    setFetchError(null)
    runAnalysis()
  }

  const filteredAnomalies = filter === 'all'
    ? anomalies
    : anomalies.filter(a => a.severity === filter)

  const summary = {
    critical: anomalies.filter(a => a.severity === 'critical').length,
    high: anomalies.filter(a => a.severity === 'high').length,
    medium: anomalies.filter(a => a.severity === 'medium').length,
    low: anomalies.filter(a => a.severity === 'low').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldAlert className="size-6" />
            Anomaly Detection
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered detection of unusual patterns in your business data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastAnalyzed && (
            <span className="text-xs text-muted-foreground">
              Last analyzed: {new Date(lastAnalyzed).toLocaleTimeString()}
            </span>
          )}
          <Button onClick={runAnalysis} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="size-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {anomalies.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.high}</div>
              <div className="text-xs text-muted-foreground">High</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
              <div className="text-xs text-muted-foreground">Medium</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.low}</div>
              <div className="text-xs text-muted-foreground">Low</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter Tabs */}
      {anomalies.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {['all', 'critical', 'high', 'medium', 'low'].map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `All (${anomalies.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${summary[f as keyof typeof summary]})`}
            </Button>
          ))}
        </div>
      )}

      {/* Error State */}
      {fetchError && (
        <ErrorState title="Failed to load data" message={fetchError} onRetry={handleRetry} />
      )}

      {/* Loading State */}
      {!fetchError && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="size-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing your data for anomalies...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!fetchError && anomalies.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldAlert className="size-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No anomalies detected yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Click &quot;Run Analysis&quot; to scan your data for unusual patterns, stock drops, and suspicious activities.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Anomaly Cards */}
      {!fetchError && anomalies.length > 0 && !loading && (
        <div className="space-y-3">
          {filteredAnomalies.map((anomaly) => (
            <AnomalyCard key={anomaly.id} anomaly={anomaly} />
          ))}
          {filteredAnomalies.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No anomalies with &quot;{filter}&quot; severity found.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
