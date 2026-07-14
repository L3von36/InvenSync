'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  Loader2,
  ArrowRight,
  Server,
  Shield,
  Key,
  FileCode,
  Zap,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ErrorState } from '@/components/shared/error-states'

// ============================================
// Types
// ============================================

interface SupabaseConfig {
  configured: boolean
  url: string | null
  hasAnonKey: boolean
}

interface DatabaseInfo {
  status: 'connected' | 'unreachable' | 'schema_missing'
  tableCount: number
  provider: string
}

interface AuthInfo {
  mode: string
}

interface SetupStatus {
  supabase: SupabaseConfig
  database: DatabaseInfo
  auth: AuthInfo
}

type SetupStep = 'check-env' | 'run-migration' | 'enable-pooling' | 'configure-auth' | 'push-schema' | 'seed-database'

// ============================================
// Helpers
// ============================================

function getStatusIcon(status: 'connected' | 'unreachable' | 'schema_missing') {
  switch (status) {
    case 'connected':
      return <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
    case 'unreachable':
      return <XCircle className="size-5 text-red-500 dark:text-red-400" />
    case 'schema_missing':
      return <AlertTriangle className="size-5 text-amber-500 dark:text-amber-400" />
  }
}

function getStatusBadge(status: 'connected' | 'unreachable' | 'schema_missing') {
  switch (status) {
    case 'connected':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
          Connected
        </Badge>
      )
    case 'unreachable':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
          Unreachable
        </Badge>
      )
    case 'schema_missing':
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
          Schema Missing
        </Badge>
      )
  }
}

// ============================================
// Loading Skeleton
// ============================================

function SetupLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// Step Card Component
// ============================================

interface StepCardProps {
  stepNumber: number
  title: string
  description: string
  icon: React.ReactNode
  isCompleted: boolean
  isActive: boolean
  children?: React.ReactNode
}

function StepCard({ stepNumber, title, description, icon, isCompleted, isActive, children }: StepCardProps) {
  const [expanded, setExpanded] = useState(isActive)

  return (
    <div
      className={`rounded-xl border transition-all ${
        isCompleted
          ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
          : isActive
            ? 'border-primary/30 bg-primary/5'
            : 'border hover:border-muted-foreground/20'
      }`}
    >
      <button
        className="flex items-start gap-4 w-full p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
            isCompleted
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : isActive
                ? 'bg-primary/10'
                : 'bg-muted'
          }`}
        >
          {isCompleted ? (
            <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            icon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Step {stepNumber}</span>
            {isCompleted && (
              <Badge variant="outline" className="text-[0.769rem] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                Done
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-semibold mt-0.5">{title}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        </div>
        <div className="shrink-0 mt-1">
          {expanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && children && (
        <div className="px-4 pb-4 pt-0">
          <Separator className="mb-4" />
          {children}
        </div>
      )}
    </div>
  )
}

// ============================================
// Main Component
// ============================================

export function SupabaseSetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [pushingSchema, setPushingSchema] = useState(false)
  const [seedingDatabase, setSeedingDatabase] = useState(false)
  const [copied, setCopied] = useState(false)

  // Fetch status on mount
  const fetchStatus = useCallback(async () => {
    try {
      setFetchError(null)
      const res = await fetch('/api/setup/status')
      if (!res.ok) {
        throw new Error(`Failed to check status (${res.status})`)
      }
      const data = await res.json()
      setStatus(data)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to check setup status')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchStatus()
  }

  const handlePushSchema = async () => {
    setPushingSchema(true)
    try {
      const res = await fetch('/api/setup/database', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to push schema (${res.status})`)
      }
      toast.success('Database schema pushed successfully!')
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to push schema')
    } finally {
      setPushingSchema(false)
    }
  }

  const handleSeedDatabase = async () => {
    setSeedingDatabase(true)
    try {
      const res = await fetch('/api/setup/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed to seed database (${res.status})`)
      }
      toast.success('Database seeded successfully! Sample data has been added.')
      fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to seed database')
    } finally {
      setSeedingDatabase(false)
    }
  }

  const handleCopySQL = () => {
    // We'll provide a note about copying from the file since we can't read it from client
    const sqlNotice = `-- Copy the content from supabase-migration.sql in your project root\n-- Or visit your Supabase Dashboard SQL Editor to run the migration`
    navigator.clipboard.writeText(sqlNotice).then(() => {
      setCopied(true)
      toast.success('Migration file reference copied! Check supabase-migration.sql in your project root.')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      toast.error('Failed to copy to clipboard')
    })
  }

  // ============================================
  // Loading State
  // ============================================

  if (loading) {
    return <SetupLoadingSkeleton />
  }

  // ============================================
  // Error State
  // ============================================

  if (fetchError && !status) {
    return (
      <ErrorState
        title="Failed to check setup status"
        error={fetchError}
        onRetry={fetchStatus}
      />
    )
  }

  // ============================================
  // Derived state
  // ============================================

  const dbStatus = status?.database.status ?? 'unreachable'
  const isSupabaseConfigured = status?.supabase.configured ?? false
  const isConnected = dbStatus === 'connected'
  const isSchemaMissing = dbStatus === 'schema_missing'
  const isUnreachable = dbStatus === 'unreachable'

  // Determine the current setup step
  const currentStep: SetupStep = ((): SetupStep => {
    if (!isSupabaseConfigured) return 'check-env'
    if (isUnreachable) return 'run-migration'
    if (isSchemaMissing) return 'push-schema'
    return 'seed-database'
  })()

  // ============================================
  // Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Supabase Setup</h1>
          <p className="text-muted-foreground text-sm">
            Configure your Supabase database connection for InvenSync
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Supabase Connection */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
                isSupabaseConfigured
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {isSupabaseConfigured ? (
                  <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="size-5 text-red-500 dark:text-red-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Supabase Config</p>
                <p className="text-sm font-semibold">
                  {isSupabaseConfigured ? 'Configured' : 'Not Configured'}
                </p>
                {status?.supabase.url && (
                  <p className="text-xs text-muted-foreground truncate">
                    {status.supabase.url.replace('https://', '').replace('.supabase.co', '')}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-10 rounded-lg shrink-0 ${
                isConnected
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : isSchemaMissing
                    ? 'bg-amber-100 dark:bg-amber-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                {getStatusIcon(dbStatus)}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Database</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {getStatusBadge(dbStatus)}
                </div>
                {isConnected && status?.database.tableCount !== undefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {status.database.tableCount} tables · {status.database.provider}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Auth Mode */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-lg shrink-0 bg-primary/10">
                <Shield className="size-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Auth Mode</p>
                <p className="text-sm font-semibold capitalize">
                  {status?.auth.mode === 'supabase' ? 'Supabase Auth' : 'Legacy JWT'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status?.auth.mode === 'supabase'
                    ? 'httpOnly cookies'
                    : 'Local development mode'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Connected - Success State */}
      {isConnected && !isSchemaMissing && (
        <Alert className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-900/10">
          <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertTitle className="text-emerald-800 dark:text-emerald-300">All Systems Operational</AlertTitle>
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Your Supabase database is connected and the schema is up to date. You can seed the database with sample data or start using InvenSync.
          </AlertDescription>
        </Alert>
      )}

      {/* Unreachable Warning */}
      {isUnreachable && (
        <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Database Unreachable</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Your Supabase database cannot be reached. This usually means the database hasn&apos;t been set up yet or the connection details are incorrect. Follow the steps below to configure it.
          </AlertDescription>
        </Alert>
      )}

      {/* Schema Missing Warning */}
      {isSchemaMissing && (
        <Alert className="border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Schema Missing</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Your database is connected but the required tables haven&apos;t been created yet. Use the &quot;Push Schema&quot; button below to set up the database schema.
          </AlertDescription>
        </Alert>
      )}

      {/* Step-by-Step Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Setup Guide</CardTitle>
          <CardDescription>Follow these steps to connect your Supabase database</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Environment Variables */}
          <StepCard
            stepNumber={1}
            title="Configure Environment Variables"
            description="Add your Supabase project URL and anon key to your .env file"
            icon={<Key className="size-5 text-primary" />}
            isCompleted={isSupabaseConfigured}
            isActive={currentStep === 'check-env'}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add the following variables to your <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">.env</code> file:
              </p>
              <div className="rounded-lg bg-muted/50 border p-4 font-mono text-xs space-y-2 overflow-x-auto">
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">NEXT_PUBLIC_SUPABASE_URL</span>
                  <span className="text-muted-foreground">=https://your-project.supabase.co</span>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                  <span className="text-muted-foreground">=your-anon-key-here</span>
                </div>
                <div>
                  <span className="text-emerald-600 dark:text-emerald-400">SUPABASE_SERVICE_ROLE_KEY</span>
                  <span className="text-muted-foreground">=your-service-role-key-here</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Find these in your Supabase Dashboard under <strong>Project Settings → API</strong>
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              >
                <ExternalLink className="size-3.5" />
                Open Supabase Dashboard
              </Button>
            </div>
          </StepCard>

          {/* Step 2: Run Migration SQL */}
          <StepCard
            stepNumber={2}
            title="Run Database Migration"
            description="Execute the migration SQL in the Supabase SQL Editor to create tables"
            icon={<FileCode className="size-5 text-primary" />}
            isCompleted={isConnected}
            isActive={currentStep === 'run-migration'}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  2a
                </div>
                <div>
                  <p className="text-sm font-medium">Go to SQL Editor</p>
                  <p className="text-xs text-muted-foreground">
                    Navigate to <strong>Supabase Dashboard → SQL Editor</strong> in your project
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  2b
                </div>
                <div>
                  <p className="text-sm font-medium">Paste the Migration SQL</p>
                  <p className="text-xs text-muted-foreground">
                    Copy the content from <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">supabase-migration.sql</code> in your project root and paste it into the SQL Editor
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                  2c
                </div>
                <div>
                  <p className="text-sm font-medium">Execute the Query</p>
                  <p className="text-xs text-muted-foreground">
                    Click <strong>&quot;Run&quot;</strong> to execute the migration and create all required tables
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleCopySQL}
                >
                  {copied ? (
                    <CheckCircle className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? 'Copied!' : 'Copy SQL Reference'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
                >
                  <ExternalLink className="size-3.5" />
                  Open SQL Editor
                </Button>
              </div>
            </div>
          </StepCard>

          {/* Step 3: Enable Connection Pooling */}
          <StepCard
            stepNumber={3}
            title="Enable Connection Pooling"
            description="Configure Supavisor connection pooling for better performance"
            icon={<Zap className="size-5 text-primary" />}
            isCompleted={isConnected}
            isActive={currentStep === 'enable-pooling'}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connection pooling improves database performance and reliability by reusing connections:
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">1.</span>
                  <span>Go to <strong>Project Settings → Database</strong> in Supabase Dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">2.</span>
                  <span>Find the <strong>&quot;Connection Pooling&quot;</strong> section</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">3.</span>
                  <span>Enable pooling with <strong>Supavisor</strong> mode set to <strong>&quot;Transaction&quot;</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">4.</span>
                  <span>Use the pooled connection string (port 6543) in your configuration</span>
                </li>
              </ol>
            </div>
          </StepCard>

          {/* Step 4: Configure Email Auth */}
          <StepCard
            stepNumber={4}
            title="Configure Email Authentication"
            description="Set up email auth settings in Supabase for user registration and login"
            icon={<Lock className="size-5 text-primary" />}
            isCompleted={isConnected && status?.auth.mode === 'supabase'}
            isActive={currentStep === 'configure-auth'}
          >
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configure authentication settings for Ethiopian businesses:
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">1.</span>
                  <span>Go to <strong>Authentication → Providers</strong> in Supabase Dashboard</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">2.</span>
                  <span>Ensure <strong>Email provider</strong> is enabled</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">3.</span>
                  <span>Under <strong>Authentication → URL Configuration</strong>, set the site URL to your app URL</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">4.</span>
                  <span>Add redirect URLs: <code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">http://localhost:3000/auth/callback</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-xs font-bold text-primary mt-0.5 shrink-0">5.</span>
                  <span>Optionally enable <strong>Confirm email</strong> for new signups</span>
                </li>
              </ol>
            </div>
          </StepCard>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Database Actions</CardTitle>
          <CardDescription>Push schema or seed your database with sample data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Push Schema Button */}
            <Button
              className="gap-2"
              onClick={handlePushSchema}
              disabled={pushingSchema || isConnected}
            >
              {pushingSchema ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Database className="size-4" />
              )}
              {pushingSchema ? 'Pushing Schema...' : isConnected ? 'Schema Applied' : 'Push Schema'}
            </Button>

            {/* Seed Database Button */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleSeedDatabase}
              disabled={seedingDatabase || !isConnected}
            >
              {seedingDatabase ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Globe className="size-4" />
              )}
              {seedingDatabase ? 'Seeding...' : 'Seed Database'}
            </Button>
          </div>

          {!isConnected && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
              <ArrowRight className="size-3" />
              Connect your database first to enable these actions
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Reference Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Reference</CardTitle>
          <CardDescription>Useful links and information for your setup</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Server className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Supabase Dashboard</p>
                <p className="text-xs text-muted-foreground">Manage your project, database, and auth</p>
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                >
                  supabase.com/dashboard
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <FileCode className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Migration File</p>
                <p className="text-xs text-muted-foreground">SQL schema for your Supabase project</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  supabase-migration.sql
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Shield className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Auth Configuration</p>
                <p className="text-xs text-muted-foreground">Dual-mode auth: Supabase + Legacy JWT</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current: <span className="font-medium capitalize">{status?.auth.mode || 'legacy'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Globe className="size-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Ethiopian Configuration</p>
                <p className="text-xs text-muted-foreground">Default currency: ETB (Ethiopian Birr)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Region: Addis Ababa · Phone: +251
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
