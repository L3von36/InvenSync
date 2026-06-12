'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Search, Loader2, RefreshCw, Download,
  ChevronDown, ChevronRight, Activity, User, Shield, Clock,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { formatDateWithTime } from '@/lib/admin-utils'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

// ============================================
// Types
// ============================================
interface AuditLogEntry {
  id: string
  action: string
  entity: string
  entityId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  organizationId: string | null
  user: { id: string; name: string; email: string; role: string } | null
}

interface AuditSummary {
  totalActionsToday: number
  mostActiveUser: { name: string; count: number } | null
  mostChangedEntity: { entity: string; count: number } | null
}

interface AuditFilters {
  actions: string[]
  entities: string[]
}

const PAGE_SIZE = 20

// ============================================
// Action Badge Colors
// ============================================
function actionBadgeColor(action: string): string {
  const colors: Record<string, string> = {
    create: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    update: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    delete: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    login: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    logout: 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300',
  }
  return colors[action] || 'bg-gray-100 text-gray-800'
}

function entityIcon(entity: string): string {
  const icons: Record<string, string> = {
    Product: '📦',
    Sale: '💰',
    Customer: '👤',
    User: '🧑‍💼',
    Supplier: '🚚',
    Shop: '🏪',
    Organization: '🏢',
    Inventory: '📋',
  }
  return icons[entity] || '📄'
}

// ============================================
// Audit Log Page Component
// ============================================
export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [summary, setSummary] = useState<AuditSummary | null>(null)
  const [filterOptions, setFilterOptions] = useState<AuditFilters>({ actions: [], entities: [] })
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminAuditLogs({
        page,
        limit: PAGE_SIZE,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entity: entityFilter !== 'all' ? entityFilter : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: search || undefined,
      })
      setLogs(data.logs || [])
      setSummary(data.summary || null)
      setFilterOptions(data.filters || { actions: [], entities: [] })
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [search, actionFilter, entityFilter, dateFrom, dateTo, page])

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300)
    return () => clearTimeout(timer)
  }, [fetchLogs])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [search, actionFilter, entityFilter, dateFrom, dateTo])

  // Export to CSV
  const exportCSV = async () => {
    try {
      toast.loading('Exporting audit logs...', { id: 'export-csv' })
      // Fetch all matching logs (up to 5000)
      const data = await api.getAdminAuditLogs({
        page: 1,
        limit: 5000,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        entity: entityFilter !== 'all' ? entityFilter : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: search || undefined,
      })

      const headers = ['Timestamp', 'User Name', 'User Email', 'Action', 'Entity', 'Entity ID', 'IP Address', 'Details']
      const rows = data.logs.map(log => [
        log.createdAt,
        log.user?.name || 'System',
        log.user?.email || '',
        log.action,
        log.entity,
        log.entityId || '',
        log.ipAddress || '',
        log.details ? `"${log.details.replace(/"/g, '""')}"` : '',
      ])

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(link.href)

      toast.success(`Exported ${data.logs.length} audit logs`, { id: 'export-csv' })
    } catch (err) {
      toast.error(getNetworkErrorMessage(err), { id: 'export-csv' })
    }
  }

  // Summary cards
  const summaryCards = summary ? [
    {
      title: 'Actions Today',
      value: summary.totalActionsToday,
      icon: Activity,
      color: 'text-primary',
      bg: 'bg-brand-50 dark:bg-brand-900/20',
    },
    {
      title: 'Most Active User',
      value: summary.mostActiveUser?.name || 'N/A',
      subtitle: summary.mostActiveUser ? `${summary.mostActiveUser.count} actions` : undefined,
      icon: User,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      title: 'Most Changed Entity',
      value: summary.mostChangedEntity?.entity || 'N/A',
      subtitle: summary.mostChangedEntity ? `${summary.mostChangedEntity.count} changes` : undefined,
      icon: Shield,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-900/30',
    },
  ] : []

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Track all system activities and changes</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  // Error state
  if (fetchError && logs.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">Track all system activities and changes</p>
        </div>
        <ErrorState
          title="Failed to load audit logs"
          message={fetchError}
          onRetry={() => { setLoading(true); fetchLogs() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Audit Log
          </h1>
          <p className="text-muted-foreground text-sm">Track all system activities and changes</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="shrink-0 gap-2">
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summaryCards.map((card) => (
            <Card key={card.title}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`size-5 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                    <p className="text-sm font-semibold truncate">{card.value}</p>
                    {card.subtitle && (
                      <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search entity ID or details..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Action filter */}
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                {filterOptions.actions
                  .filter(a => !['create', 'update', 'delete', 'login', 'logout'].includes(a))
                  .map(action => (
                    <SelectItem key={action} value={action}>{action}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Entity filter */}
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Entity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {filterOptions.entities.map(entity => (
                  <SelectItem key={entity} value={entity}>{entityIcon(entity)} {entity}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date from */}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From date"
            />

            {/* Date to */}
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To date"
            />
          </div>

          {/* Active filters display + clear */}
          {(actionFilter !== 'all' || entityFilter !== 'all' || dateFrom || dateTo || search) && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Active filters:</span>
              {search && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Search: &quot;{search}&quot;
                </Badge>
              )}
              {actionFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Action: {actionFilter}
                </Badge>
              )}
              {entityFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs gap-1">
                  Entity: {entityFilter}
                </Badge>
              )}
              {dateFrom && (
                <Badge variant="secondary" className="text-xs gap-1">
                  From: {dateFrom}
                </Badge>
              )}
              {dateTo && (
                <Badge variant="secondary" className="text-xs gap-1">
                  To: {dateTo}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-auto py-0.5 px-2"
                onClick={() => {
                  setSearch('')
                  setActionFilter('all')
                  setEntityFilter('all')
                  setDateFrom('')
                  setDateTo('')
                }}
              >
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Activity Log
              <span className="text-muted-foreground ml-2">({total} entries)</span>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setLoading(true); fetchLogs() }}
              className="gap-1"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState
              title="No audit logs found"
              message="No activity logs match your current filters. Try adjusting your search criteria."
              icon={<AlertTriangle className="size-7 text-muted-foreground" />}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <AuditLogRow
                        key={log.id}
                        log={log}
                        expanded={expandedRows.has(log.id)}
                        onToggle={() => toggleRow(log.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y">
                {logs.map((log) => (
                  <MobileAuditCard
                    key={log.id}
                    log={log}
                    expanded={expandedRows.has(log.id)}
                    onToggle={() => toggleRow(log.id)}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Audit Log Row (Desktop)
// ============================================
function AuditLogRow({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLogEntry
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <TableCell className="w-8 px-2">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-muted-foreground" />
            {formatDateWithTime(log.createdAt)}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm font-medium">
            {log.user?.name || 'System'}
          </div>
          <div className="text-xs text-muted-foreground">
            {log.user?.email || ''}
          </div>
        </TableCell>
        <TableCell>
          <Badge className={`text-xs ${actionBadgeColor(log.action)}`}>
            {log.action}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="text-sm">
            {entityIcon(log.entity)} {log.entity}
          </span>
        </TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground max-w-[120px] truncate">
          {log.entityId || '—'}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground font-mono">
          {log.ipAddress || '—'}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 px-8 py-3">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Details</p>
              {log.details ? (
                <pre className="text-xs bg-background rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto border">
                  {formatJSON(log.details)}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground italic">No details available</p>
              )}
              {log.userAgent && (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-muted-foreground">User Agent</p>
                  <p className="text-xs text-muted-foreground break-all">{log.userAgent}</p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ============================================
// Mobile Audit Card
// ============================================
function MobileAuditCard({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLogEntry
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="p-4">
      <button
        className="w-full text-left"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={`text-xs ${actionBadgeColor(log.action)}`}>
                {log.action}
              </Badge>
              <span className="text-sm">
                {entityIcon(log.entity)} {log.entity}
              </span>
            </div>
            <p className="text-sm font-medium truncate">
              {log.user?.name || 'System'}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {formatDateWithTime(log.createdAt)}
            </p>
          </div>
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground shrink-0 mt-1" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 pl-0">
          {log.entityId && (
            <div>
              <span className="text-xs text-muted-foreground">Entity ID: </span>
              <span className="text-xs font-mono">{log.entityId}</span>
            </div>
          )}
          {log.ipAddress && (
            <div>
              <span className="text-xs text-muted-foreground">IP: </span>
              <span className="text-xs font-mono">{log.ipAddress}</span>
            </div>
          )}
          {log.details && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Details</p>
              <pre className="text-xs bg-muted rounded-lg p-2 overflow-x-auto max-h-40 overflow-y-auto">
                {formatJSON(log.details)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================
// Helper: Format JSON string
// ============================================
function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}
