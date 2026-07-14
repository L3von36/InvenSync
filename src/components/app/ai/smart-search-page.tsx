'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Sparkles, Loader2, Clock, Package, DollarSign,
  Users, Truck, Store, X, ArrowRight, TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatETB } from '@/lib/admin-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ErrorState } from '@/components/shared/error-states'

// ============================================
// Types
// ============================================
interface ProductResult {
  id: string
  name: string
  sku: string | null
  quantity: number
  costPrice: number
  sellingPrice: number
  lowStock: boolean
  productType: string | null
}

interface SaleResult {
  id: string
  saleNumber: string | null
  total: number
  status: string
  saleDate: string
  customerName: string | null
}

interface CustomerResult {
  id: string
  name: string
  phone: string | null
  email: string | null
  balance: number
  hasDebt: boolean
}

interface SupplierResult {
  id: string
  name: string
  phone: string | null
  email: string | null
  city: string | null
  balance: number
}

interface ShopResult {
  id: string
  name: string
  city: string | null
  isActive: boolean
}

type SearchResult = ProductResult | SaleResult | CustomerResult | SupplierResult | ShopResult

type CategorizedResults = {
  Product?: ProductResult[]
  Sale?: SaleResult[]
  Customer?: CustomerResult[]
  Supplier?: SupplierResult[]
  Shop?: ShopResult[]
}

// ============================================
// Search Suggestions
// ============================================
const searchSuggestions = [
  'Products low stock over 500 ETB',
  'Sales this week',
  'Customers with debts',
  'All suppliers',
  'Products out of stock',
  'Sales today',
  'Customers with balance over 1000 ETB',
  'My shops',
]

// ============================================
// Entity Config
// ============================================
const entityConfig: Record<string, {
  icon: React.ElementType
  label: string
  color: string
  bgColor: string
}> = {
  // Design rule: entity types are distinguished by their icon, not by
  // decorative colors — color is reserved for state (warnings, errors).
  Product: {
    icon: Package,
    label: 'Products',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  Sale: {
    icon: DollarSign,
    label: 'Sales',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  Customer: {
    icon: Users,
    label: 'Customers',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  Supplier: {
    icon: Truck,
    label: 'Suppliers',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  Shop: {
    icon: Store,
    label: 'Shops',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
}

// ============================================
// Smart Search Page Component
// ============================================
export function SmartSearchPage() {
  const { currentOrg } = useAuthStore()
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<CategorizedResults | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smart-search-recent')
      if (saved) {
        setRecentSearches(JSON.parse(saved))
      }
    } catch {
      // ignore
    }
  }, [])

  // Save recent search to localStorage
  const saveRecentSearch = useCallback((q: string) => {
    setRecentSearches(prev => {
      const updated = [q, ...prev.filter(s => s !== q)].slice(0, 8)
      try {
        localStorage.setItem('smart-search-recent', JSON.stringify(updated))
      } catch {
        // ignore
      }
      return updated
    })
  }, [])

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([])
    try {
      localStorage.removeItem('smart-search-recent')
    } catch {
      // ignore
    }
    toast.success('Recent searches cleared')
  }, [])

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !currentOrg) return

    setQuery(searchQuery)
    setIsSearching(true)
    setError(null)
    setShowSuggestions(false)
    saveRecentSearch(searchQuery.trim())

    try {
      const data = await api.smartSearch(currentOrg.id, searchQuery.trim())
      setResults(data.results as CategorizedResults)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setError(msg)
      toast.error('Search failed', { description: msg })
    } finally {
      setIsSearching(false)
      inputRef.current?.focus()
    }
  }, [currentOrg, saveRecentSearch])

  // Handle form submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    performSearch(query)
  }, [query, performSearch])

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    performSearch(suggestion)
  }, [performSearch])

  // Total results count
  const totalResults = results
    ? Object.values(results).reduce((sum, arr) => sum + (arr?.length || 0), 0)
    : 0

  // Filter suggestions based on current query
  const filteredSuggestions = query.trim()
    ? searchSuggestions.filter(s =>
        s.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Sparkles />}
        title="Smart Search"
        subtitle="Search anything using natural language"
      />

      {/* Search Input */}
      <div className="relative">
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Search anything... (e.g., 'products low stock over 500 ETB', 'sales this week', 'customers with debts')"
              className="pl-12 pr-24 h-14 text-base rounded-xl border-2 focus:border-primary"
              disabled={isSearching}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 md:size-8"
                  onClick={() => {
                    setQuery('')
                    setResults(null)
                    setError(null)
                    inputRef.current?.focus()
                  }}
                >
                  <X className="size-4" />
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                className="gap-1.5 rounded-lg"
                disabled={!query.trim() || isSearching}
              >
                {isSearching ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Search
              </Button>
            </div>
          </div>
        </form>

        {/* Autocomplete Suggestions */}
        <AnimatePresence>
          {showSuggestions && query.trim() && filteredSuggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="absolute z-50 top-full mt-1 w-full bg-background border rounded-xl shadow-lg overflow-hidden"
            >
              {filteredSuggestions.map((suggestion, idx) => (
                <button
                  key={suggestion}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 flex items-center gap-2 transition-colors"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <TrendingUp className="size-4 text-muted-foreground shrink-0" />
                  <span>{highlightMatch(suggestion, query)}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Recent Searches & Suggestions (shown when not searching and no results) */}
      {!isSearching && !results && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    Recent Searches
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto py-0.5 px-2"
                    onClick={clearRecentSearches}
                  >
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {recentSearches.map((search) => (
                    <button
                      key={search}
                      className="w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-muted/50 flex items-center justify-between group transition-colors"
                      onClick={() => handleSuggestionClick(search)}
                    >
                      <span className="truncate">{search}</span>
                      <ArrowRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search Suggestions */}
          <Card className={recentSearches.length === 0 ? 'md:col-span-2' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Try These Searches
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {searchSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="flex items-center gap-2 p-3 rounded-lg border text-left text-sm
                      hover:border-primary/60 hover:bg-brand-50/50 dark:hover:bg-brand-900/10
                      transition-colors"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <Search className="size-4 text-primary shrink-0" />
                    <span className="text-xs">{suggestion}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Searching with AI...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isSearching && (
        <ErrorState title="Search Failed" message={error} onRetry={() => performSearch(query)} />
      )}

      {/* Results */}
      {!isSearching && results && (
        <div className="space-y-4">
          {/* Results summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found <span className="font-semibold text-foreground">{totalResults}</span> results
              for &quot;{query}&quot;
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setResults(null)
                setQuery('')
                setError(null)
                inputRef.current?.focus()
              }}
              className="gap-1"
            >
              <X className="size-3.5" />
              Clear
            </Button>
          </div>

          {/* Categorized results */}
          {Object.entries(results).map(([entityType, items]) => {
            if (!items || items.length === 0) return null

            const config = entityConfig[entityType]
            if (!config) return null

            return (
              <Card key={entityType}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className={`size-7 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                      <config.icon className={`size-4 ${config.color}`} />
                    </div>
                    {config.label}
                    <Badge variant="secondary" className="text-xs ml-1">
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y">
                    {items.map((item, idx) => (
                      <EntityResultCard
                        key={item.id || idx}
                        entityType={entityType}
                        item={item}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* No results for any category */}
          {totalResults === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="size-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Search className="size-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No results found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Try a different search query or browse the suggestions above.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Entity Result Card
// ============================================
function EntityResultCard({
  entityType,
  item,
}: {
  entityType: string
  item: SearchResult
}) {
  const config = entityConfig[entityType]
  if (!config) return null

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {renderEntityDetails(entityType, item)}
        </div>
        <ArrowRight className="size-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </div>
  )
}

function renderEntityDetails(entityType: string, item: SearchResult) {
  switch (entityType) {
    case 'Product': {
      const p = item as ProductResult
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{p.name}</span>
            {p.lowStock && (
              <Badge variant="destructive" className="text-[0.769rem] px-1.5 py-0">
                Low Stock
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {p.sku && (
              <span className="text-xs text-muted-foreground">SKU: {p.sku}</span>
            )}
            <span className="text-xs text-muted-foreground">Qty: {p.quantity}</span>
            <span className="text-xs font-medium">{formatETB(p.sellingPrice)}</span>
            {p.productType && (
              <Badge variant="secondary" className="text-[0.769rem] px-1.5 py-0">
                {p.productType}
              </Badge>
            )}
          </div>
        </div>
      )
    }

    case 'Sale': {
      const s = item as SaleResult
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {s.saleNumber || `Sale #${s.id.slice(-6)}`}
            </span>
            <Badge
              className={`text-[0.769rem] px-1.5 py-0 ${
                s.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : s.status === 'pending'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              }`}
            >
              {s.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            <span className="text-xs font-medium">{formatETB(s.total)}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(s.saleDate).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </span>
            {s.customerName && (
              <span className="text-xs text-muted-foreground">
                Customer: {s.customerName}
              </span>
            )}
          </div>
        </div>
      )
    }

    case 'Customer': {
      const c = item as CustomerResult
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{c.name}</span>
            {c.hasDebt && (
              <Badge variant="destructive" className="text-[0.769rem] px-1.5 py-0">
                Has Debt
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {c.phone && (
              <span className="text-xs text-muted-foreground">{c.phone}</span>
            )}
            <span className="text-xs font-medium">
              Balance: {formatETB(c.balance)}
            </span>
          </div>
        </div>
      )
    }

    case 'Supplier': {
      const s = item as SupplierResult
      return (
        <div>
          <span className="text-sm font-medium">{s.name}</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {s.city && (
              <span className="text-xs text-muted-foreground">{s.city}</span>
            )}
            {s.phone && (
              <span className="text-xs text-muted-foreground">{s.phone}</span>
            )}
            <span className="text-xs font-medium">
              Balance: {formatETB(s.balance)}
            </span>
          </div>
        </div>
      )
    }

    case 'Shop': {
      const s = item as ShopResult
      return (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{s.name}</span>
            <Badge
              className={`text-[0.769rem] px-1.5 py-0 ${
                s.isActive
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300'
              }`}
            >
              {s.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {s.city && (
            <span className="text-xs text-muted-foreground mt-1 block">{s.city}</span>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

// ============================================
// Helper: Highlight matching text
// ============================================
function highlightMatch(text: string | null | undefined, query: string | null | undefined): React.ReactNode {
  if (!text || !query) return text || ''
  if (!query.trim()) return text

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-primary/20 rounded px-0.5">{part}</mark>
      : part
  )
}
