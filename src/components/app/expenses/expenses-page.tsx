'use client'

import { PageHeader, AvatarListRow } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@/lib/zod-resolver'
import {
  Plus, Search, RefreshCw, Pencil, Trash2, Loader2,
  DollarSign, TrendingDown, CalendarDays, Receipt, Repeat,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from '@/components/ui/recharts-exports'
import { api, type Expense } from '@/lib/api-client'
import { db } from '@/lib/db'
import { formatETB } from '@/lib/format'
import { getNetworkErrorMessage } from '@/lib/validation'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { useAuthStore } from '@/lib/stores/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form } from '@/components/ui/form'
import { toast } from 'sonner'
import { expenseFormSchema, type ExpenseFormData } from '@/lib/validations'

// ============================================
// Constants
// ============================================

const EXPENSE_CATEGORIES = [
  { value: 'rent', label: 'Rent' },
  { value: 'salary', label: 'Salary' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
]

// ============================================
// Helpers
// ============================================

const CATEGORY_LABELS: Record<string, string> = {
  rent: 'Rent', salary: 'Salary', utilities: 'Utilities',
  marketing: 'Marketing', supplies: 'Supplies', transport: 'Transport', other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  rent: 'bg-blue-100 text-blue-700',
  salary: 'bg-purple-100 text-purple-700',
  utilities: 'bg-amber-100 text-amber-700',
  marketing: 'bg-pink-100 text-pink-700',
  supplies: 'bg-emerald-100 text-emerald-700',
  transport: 'bg-cyan-100 text-cyan-700',
  other: 'bg-gray-100 text-gray-700',
}

function formatMonthLabel(monthKey: string): string {
  const MONTH_LABELS: Record<string, string> = {
    '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
  }
  const [year, month] = monthKey.split('-')
  return `${MONTH_LABELS[month] || month} ${year.slice(2)}`
}

// ============================================
// Main Component
// ============================================

export function ExpensesPage() {
  const { currentOrg, shops } = useAuthStore()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [monthlySummary, setMonthlySummary] = useState<Array<{ month: string; total: number }>>([])

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: '',
      amount: 0,
      description: '',
      expenseDate: new Date().toISOString().split('T')[0],
      shopId: '',
      isRecurring: false,
      recurringPeriod: '',
    },
  })

  const isRecurring = form.watch('isRecurring')

  // ============================================
  // Local-First Data Loading (Repository Pattern)
  // ============================================
  // Reads from IndexedDB FIRST (instant, works offline), then refreshes
  // from the API in the background and persists back to IndexedDB.
  const fetchExpenses = useCallback(async () => {
    if (!currentOrg) return
    setIsLoading(true)
    setError(null)

    // ---- Step 1: Read from IndexedDB FIRST (instant, offline) ----
    try {
      let localExpenses = await db.expenses
        .where('organizationId')
        .equals(currentOrg.id)
        .toArray()

      // Apply category filter locally
      if (categoryFilter && categoryFilter !== 'all') {
        localExpenses = localExpenses.filter((e) => e.category === categoryFilter)
      }

      // Sort by date desc (newest first)
      localExpenses.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )

      // Compute total + monthly summary from local data
      const localTotal = localExpenses.reduce((sum, e) => sum + e.amount, 0)
      setExpenses(localExpenses as unknown as Expense[])
      setTotalExpenses(localTotal)

      // Monthly summary from local data
      const monthMap: Record<string, number> = {}
      for (const e of localExpenses) {
        const d = new Date(e.date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthMap[key] = (monthMap[key] || 0) + e.amount
      }
      const localMonthly = Object.entries(monthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, total]) => ({ month, total }))
      setMonthlySummary(localMonthly)

      setIsLoading(false)
    } catch {
      setIsLoading(true)
    }

    // ---- Step 2: If online, refresh from API and update IndexedDB ----
    try {
      const params: { category?: string } = {}
      if (categoryFilter && categoryFilter !== 'all') params.category = categoryFilter

      const result = await api.getExpenses(currentOrg.id, params)
      setExpenses(result.expenses || [])
      setTotalExpenses(result.summary?.totalExpenses || 0)
      setMonthlySummary(result.monthlySummary || [])

      // Persist to IndexedDB for future offline reads
      try {
        const localRecords = (result.expenses || []).map((e) => ({
          id: e.id,
          organizationId: e.organizationId,
          shopId: e.shopId || null,
          category: e.category || '',
          amount: e.amount ?? 0,
          description: e.description || null,
          date: e.expenseDate || new Date().toISOString(),
          isRecurring: e.isRecurring ?? null,
          createdAt: e.createdAt || new Date().toISOString(),
          updatedAt: e.updatedAt || new Date().toISOString(),
        }))
        if (localRecords.length > 0) {
          await db.expenses.bulkPut(localRecords)
        }
      } catch {
        // Caching failure is non-critical
      }
    } catch (err) {
      if (expenses.length === 0) {
        setError(getNetworkErrorMessage(err))
      }
    } finally {
      setIsLoading(false)
    }
  }, [currentOrg, categoryFilter, expenses.length])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // Filter expenses client-side by search query
  const filteredExpenses = searchQuery
    ? expenses.filter(e =>
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        CATEGORY_LABELS[e.category]?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : expenses

  function openCreateDialog() {
    setEditingExpense(null)
    form.reset({
      category: '',
      amount: 0,
      description: '',
      expenseDate: new Date().toISOString().split('T')[0],
      shopId: '',
      isRecurring: false,
      recurringPeriod: '',
    })
    setDialogOpen(true)
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense)
    form.reset({
      category: expense.category,
      amount: expense.amount,
      description: expense.description || '',
      expenseDate: new Date(expense.expenseDate).toISOString().split('T')[0],
      shopId: expense.shopId || '',
      isRecurring: expense.isRecurring,
      recurringPeriod: expense.recurringPeriod || '',
    })
    setDialogOpen(true)
  }

  async function onSubmit(formData: ExpenseFormData) {
    if (!currentOrg) return
    setIsSaving(true)
    try {
      const payload = {
        category: formData.category,
        amount: formData.amount,
        description: formData.description || null,
        expenseDate: formData.expenseDate,
        shopId: formData.shopId || null,
        isRecurring: formData.isRecurring,
        recurringPeriod: formData.isRecurring ? formData.recurringPeriod : null,
      }

      if (editingExpense) {
        await api.updateExpense(editingExpense.id, currentOrg.id, payload)
        toast.success('Expense updated successfully')
      } else {
        await api.createExpense(currentOrg.id, payload)
        toast.success('Expense created successfully')
      }

      setDialogOpen(false)
      fetchExpenses()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    if (!currentOrg || !deleteTarget) return
    setIsDeleting(true)
    try {
      await api.deleteExpense(deleteTarget.id, currentOrg.id)
      toast.success('Expense deleted successfully')
      setDeleteTarget(null)
      fetchExpenses()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setIsDeleting(false)
    }
  }

  if (error) {
    return <ErrorState title="Failed to load Expenses" message={error} onRetry={fetchExpenses} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Receipt />}
        title="Expenses"
        subtitle="Track and manage your business expenses"
        actions={
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="size-4" />
            Add Expense
          </Button>
        }
      />

      {/* KPI Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">Total Expenses</p>
              <p className="text-xl sm:text-2xl font-semibold tabular-nums tracking-tight">
                {isLoading ? <Skeleton className="h-9 w-32 inline-block" /> : formatETB(totalExpenses)}
              </p>
            </div>
            <div className="size-12 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
              <TrendingDown className="size-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Monthly Expense Summary</CardTitle>
          <CardDescription>Last 6 months expense trend</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : monthlySummary.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
              No expense data available yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlySummary.map(d => ({ ...d, month: formatMonthLabel(d.month) }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatETB(value)} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="total" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            aria-label="Search expenses"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchExpenses} disabled={isLoading} aria-label="Refresh expenses">
          <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Expense List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              title="No expenses found"
              message={categoryFilter !== 'all' ? 'Try changing the filter or add a new expense' : 'Start by adding your first expense'}
              action={{ label: 'Add Expense', onClick: openCreateDialog }}
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto -mx-4 md:mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Shop</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Recurring</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-sm">
                          {new Date(expense.expenseDate).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={CATEGORY_COLORS[expense.category] || ''}>
                            {CATEGORY_LABELS[expense.category] || expense.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {expense.description || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {expense.shop?.name || '—'}
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatETB(expense.amount)}</TableCell>
                        <TableCell>
                          {expense.isRecurring ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Repeat className="size-3" />
                              {expense.recurringPeriod || 'Recurring'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">One-time</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 sm:size-8"
                              onClick={() => openEditDialog(expense)}
                              aria-label={`Edit expense`}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 sm:size-8 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(expense)}
                              aria-label={`Delete expense`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile list — Direction B avatar rows; tap opens edit,
                  compact delete stays in the badge slot */}
              <div className="md:hidden divide-y px-3">
                {filteredExpenses.map((expense) => (
                  <AvatarListRow
                    key={expense.id}
                    name={CATEGORY_LABELS[expense.category] || expense.category}
                    caption={`${new Date(expense.expenseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${expense.isRecurring ? ` · ${expense.recurringPeriod || 'Recurring'}` : ''}${expense.description ? ` · ${expense.description}` : ''}`}
                    amount={formatETB(expense.amount)}
                    badge={
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(expense) }}
                        className="p-1 -m-1 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Delete expense"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    }
                    onClick={() => openEditDialog(expense)}
                    className="rounded-none px-0 mx-0"
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>
              {editingExpense ? 'Update the expense details below' : 'Fill in the details for the new expense'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Category <span className="text-destructive">*</span>
                </label>
                <Select
                  value={form.watch('category')}
                  onValueChange={(val) => form.setValue('category', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.category && (
                  <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Amount (ETB) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register('amount', { valueAsNumber: true })}
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Optional description"
                  {...form.register('description')}
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Date <span className="text-destructive">*</span>
                </label>
                <Input
                  type="date"
                  {...form.register('expenseDate')}
                />
                {form.formState.errors.expenseDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.expenseDate.message}</p>
                )}
              </div>

              {/* Shop */}
              {shops.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shop</label>
                  <Select
                    value={form.watch('shopId') || 'none'}
                    onValueChange={(val) => form.setValue('shopId', val === 'none' ? '' : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All shops" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All shops</SelectItem>
                      {shops.map(shop => (
                        <SelectItem key={shop.id} value={shop.id}>{shop.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Recurring Toggle */}
              <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Recurring</label>
                  <p className="text-xs text-muted-foreground">Set up a recurring expense</p>
                </div>
                <Switch
                  checked={form.watch('isRecurring')}
                  onCheckedChange={(val) => form.setValue('isRecurring', val)}
                />
              </div>

              {/* Recurring Period */}
              {isRecurring && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Recurring Period</label>
                  <Select
                    value={form.watch('recurringPeriod') || ''}
                    onValueChange={(val) => form.setValue('recurringPeriod', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : editingExpense ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense of {deleteTarget ? formatETB(deleteTarget.amount) : ''}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
