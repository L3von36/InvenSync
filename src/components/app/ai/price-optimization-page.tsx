'use client'

import { useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  X,
  Filter,
  BarChart3,
  Package,
  ChevronDown,
  ChevronUp,
  Target,
} from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState } from '@/components/shared/error-states'

// ============================================
// Types
// ============================================
interface PriceSuggestion {
  id: string
  productId: string
  productName: string
  currentPrice: number
  costPrice: number
  suggestedPrice: number
  priceChange: number
  priceChangePercent: number
  currentMargin: number
  suggestedMargin: number
  confidence: 'high' | 'medium' | 'low'
  expectedImpact: string
  reasoning: string
  salesVelocity: number
  currentStock: number
}

interface PriceOptimizationResult {
  suggestions: PriceSuggestion[]
  source: 'ai' | 'rule-based'
  analyzedAt: string
  summary: {
    totalSuggestions: number
    potentialMonthlyImpact: number
    currency: string
  }
}

// ============================================
// Confidence Config
// ============================================
const confidenceConfig = {
  high: {
    color: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
    icon: Target,
    label: 'High',
  },
  medium: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300',
    icon: BarChart3,
    label: 'Medium',
  },
  low: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-950/40 dark:text-gray-300',
    icon: BarChart3,
    label: 'Low',
  },
}

// ============================================
// Price Suggestion Card
// ============================================
function PriceSuggestionCard({
  suggestion,
  currency,
  onAccept,
  onDismiss,
}: {
  suggestion: PriceSuggestion
  currency: string
  onAccept: (suggestion: PriceSuggestion) => void
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const confConfig = confidenceConfig[suggestion.confidence]
  const isPriceUp = suggestion.priceChange > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Price direction indicator */}
            <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${
              isPriceUp
                ? 'bg-green-100 dark:bg-green-950/40'
                : 'bg-orange-100 dark:bg-orange-950/40'
            }`}>
              {isPriceUp ? (
                <ArrowUpRight className="size-5 text-green-600 dark:text-green-400" />
              ) : (
                <ArrowDownRight className="size-5 text-orange-600 dark:text-orange-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Product name and confidence */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="font-semibold text-sm">{suggestion.productName}</h4>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {confConfig.label} confidence
                </Badge>
              </div>

              {/* Price comparison */}
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div>
                  <span className="text-[10px] text-muted-foreground">Current</span>
                  <p className="text-sm font-medium line-through text-muted-foreground">
                    {suggestion.currentPrice.toLocaleString()} {currency}
                  </p>
                </div>
                <div className="text-muted-foreground">→</div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Suggested</span>
                  <p className={`text-sm font-bold ${
                    isPriceUp ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                  }`}>
                    {suggestion.suggestedPrice.toLocaleString()} {currency}
                  </p>
                </div>
                <Badge
                  variant={isPriceUp ? 'default' : 'secondary'}
                  className={`text-[10px] ${
                    isPriceUp
                      ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                      : 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
                  }`}
                >
                  {isPriceUp ? '+' : ''}{suggestion.priceChangePercent.toFixed(1)}%
                </Badge>
              </div>

              {/* Margin & Stock info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <div>
                  <span className="text-[10px] text-muted-foreground">Current Margin</span>
                  <p className="text-xs font-medium">{suggestion.currentMargin.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">New Margin</span>
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    {suggestion.suggestedMargin.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Stock</span>
                  <p className="text-xs font-medium">{suggestion.currentStock} units</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">Velocity</span>
                  <p className="text-xs font-medium">{suggestion.salesVelocity.toFixed(1)}/day</p>
                </div>
              </div>

              {/* Expandable reasoning */}
              <AnimatePresence>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-2">
                      <Separator />
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Reasoning</span>
                        <p className="text-sm mt-0.5">{suggestion.reasoning}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Expected Impact</span>
                        <p className="text-sm mt-0.5">{suggestion.expectedImpact}</p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground">Cost Price</span>
                        <p className="text-sm mt-0.5">{suggestion.costPrice.toLocaleString()} {currency}</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {expanded ? (
                    <>Less <ChevronUp className="size-3" /></>
                  ) : (
                    <>More details <ChevronDown className="size-3" /></>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onDismiss(suggestion.id)}
                  >
                    <X className="size-3 mr-1" />
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => onAccept(suggestion)}
                  >
                    <Check className="size-3 mr-1" />
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Price Optimization Page
// ============================================
export function PriceOptimizationPage() {
  const { currentOrg } = useAuthStore()
  const [result, setResult] = useState<PriceOptimizationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all')
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [fetchError, setFetchError] = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    if (!currentOrg || isLoading) return

    setIsLoading(true)
    setFetchError(null)
    setDismissedIds(new Set())
    try {
      const data = await api.optimizePrices(currentOrg.id) as unknown as PriceOptimizationResult
      setResult(data)
      toast.success(`Found ${data.suggestions.length} price suggestions`, {
        description: `Analysis powered by ${data.source === 'ai' ? 'AI' : 'rule-based engine'}`,
      })
    } catch (err) {
      console.error('Price optimization failed', err)
      setFetchError(getNetworkErrorMessage(err))
      toast.error('Price analysis failed', { description: getNetworkErrorMessage(err) })
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, isLoading])

  const handleRetry = () => {
    setFetchError(null)
    runAnalysis()
  }

  const handleAccept = useCallback(async (suggestion: PriceSuggestion) => {
    if (!currentOrg) return
    try {
      await api.updateProduct(suggestion.productId, currentOrg.id, { sellingPrice: suggestion.suggestedPrice })
      toast.success('Price updated', {
        description: `${suggestion.productName}: ${suggestion.currentPrice} → ${suggestion.suggestedPrice}`,
      })
    } catch (err) {
      toast.error('Failed to update price', { description: getNetworkErrorMessage(err) })
      return // Don't dismiss if update failed
    }
    setDismissedIds(prev => new Set(prev).add(suggestion.id))
  }, [currentOrg])

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds(prev => new Set(prev).add(id))
    toast.info('Suggestion dismissed')
  }, [])

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    if (!result) return []
    return result.suggestions.filter(s => {
      if (dismissedIds.has(s.id)) return false
      if (confidenceFilter !== 'all' && s.confidence !== confidenceFilter) return false
      return true
    })
  }, [result, confidenceFilter, dismissedIds])

  // Summary calculations
  const activeSuggestions = result?.suggestions.filter(s => !dismissedIds.has(s.id)) || []
  const totalPotentialImpact = activeSuggestions.reduce(
    (sum, s) => sum + s.priceChange * s.salesVelocity * 30, 0
  )
  const currency = result?.summary.currency || currentOrg?.currency || 'ETB'

  const acceptedCount = result
    ? result.suggestions.length - activeSuggestions.length
    : 0

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <DollarSign className="size-6 text-primary" />
            AI Price Optimization
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Get AI-powered pricing suggestions to maximize revenue and optimize margins.
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
            {isLoading ? 'Analyzing...' : 'Analyze All'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {result && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{activeSuggestions.length}</p>
                  <p className="text-[10px] text-muted-foreground">Suggestions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
                  <TrendingUp className="size-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {Math.abs(totalPotentialImpact).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Est. Monthly Impact ({currency})
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                  <Target className="size-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold">{acceptedCount}</p>
                  <p className="text-[10px] text-muted-foreground">Accepted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-muted flex items-center justify-center">
                  <BarChart3 className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xl font-bold">
                    {result.source === 'ai' ? 'AI' : 'Rule'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Engine</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error State */}
      {fetchError && (
        <ErrorState title="Failed to load data" message={fetchError} onRetry={handleRetry} />
      )}

      {/* Empty State */}
      {!result && !isLoading && !fetchError && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="size-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <DollarSign className="size-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No Price Analysis Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Analyze your products to get AI-powered pricing suggestions that optimize margins and move inventory.
            </p>
            <Button
              onClick={runAnalysis}
              disabled={!currentOrg}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Sparkles className="size-4 mr-1" />
              Analyze All Products
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
                  <div className="size-10 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-1/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="grid grid-cols-4 gap-2">
                      <div className="h-6 bg-muted rounded" />
                      <div className="h-6 bg-muted rounded" />
                      <div className="h-6 bg-muted rounded" />
                      <div className="h-6 bg-muted rounded" />
                    </div>
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
          {/* Filter Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by confidence:</span>
            </div>
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="high">High Confidence</SelectItem>
                <SelectItem value="medium">Medium Confidence</SelectItem>
                <SelectItem value="low">Low Confidence</SelectItem>
              </SelectContent>
            </Select>

            {dismissedIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDismissedIds(new Set())}
              >
                Reset ({dismissedIds.size} dismissed)
              </Button>
            )}
          </div>

          {/* Suggestion Cards */}
          {filteredSuggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 flex flex-col items-center text-center">
                <div className="size-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-3">
                  <DollarSign className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold">
                  {activeSuggestions.length === 0 && result.suggestions.length > 0
                    ? 'All Suggestions Reviewed'
                    : 'No Price Suggestions'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeSuggestions.length === 0 && result.suggestions.length > 0
                    ? 'You\'ve reviewed all price suggestions. Run a new analysis anytime.'
                    : 'All your products appear to be optimally priced.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-22rem)] overflow-y-auto pr-1 custom-scrollbar">
              <AnimatePresence>
                {filteredSuggestions.map((suggestion) => (
                  <PriceSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    currency={currency}
                    onAccept={handleAccept}
                    onDismiss={handleDismiss}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  )
}
