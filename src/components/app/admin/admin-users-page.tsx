'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Search, Shield, UserCheck, UserCog, Mail,
  Loader2, RefreshCw, Building2, Eye, Pencil, Trash2,
  AlertTriangle, Store,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { getInitials, roleBadge, formatDate } from '@/lib/admin-utils'
import { type AdminUser } from '@/types/admin'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// ============================================
// Types
// ============================================
interface UserStats {
  totalUsers: number
  adminCount: number
  salesRepCount: number
  businessUserCount: number
}

const PAGE_SIZE = 15

const roleOptions = [
  { value: 'user', label: 'Business User' },
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'admin', label: 'Admin' },
]

// ============================================
// Admin Users Page
// ============================================
export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // User detail dialog
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  // Edit user dialog
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editPassword, setEditPassword] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete user dialog
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchUsers = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminUsers({
        search: search || undefined,
        role: roleFilter !== 'all' ? roleFilter : undefined,
        page,
        limit: PAGE_SIZE,
      })
      setUsers(data.users || [])
      setStats(data.stats || null)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, page])

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300)
    return () => clearTimeout(timer)
  }, [fetchUsers])

  // Edit handlers
  const openEdit = (user: AdminUser) => {
    setEditUser(user)
    setEditName(user.name)
    setEditRole(user.role)
    setEditPassword('')
  }

  const handleEditSave = async () => {
    if (!editUser) return
    setEditLoading(true)
    try {
      const data: { name?: string; role?: string; password?: string } = {}
      if (editName.trim() !== editUser.name) data.name = editName.trim()
      if (editRole !== editUser.role) data.role = editRole
      if (editPassword) data.password = editPassword

      if (Object.keys(data).length === 0) {
        setEditUser(null)
        setEditLoading(false)
        return
      }

      const result = await api.updateAdminUser(editUser.id, data)
      toast.success(`User "${result.user.name}" updated successfully`)
      setEditUser(null)
      setLoading(true)
      fetchUsers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setEditLoading(false)
    }
  }

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!deleteUser) return
    setDeleteLoading(true)
    try {
      const result = await api.deleteAdminUser(deleteUser.id)
      toast.success(result.message || `User deleted successfully`)
      setDeleteUser(null)
      setUsers(prev => prev.filter(u => u.id !== deleteUser.id))
      // Refresh stats
      setLoading(true)
      fetchUsers()
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
    } finally {
      setDeleteLoading(false)
    }
  }

  // Stats cards
  const statsCards = stats ? [
    { title: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary', bg: 'bg-brand-50 dark:bg-brand-900/20' },
    { title: 'Admins', value: stats.adminCount, icon: Shield, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
    { title: 'Sales Reps', value: stats.salesRepCount, icon: UserCheck, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
    { title: 'Business Users', value: stats.businessUserCount, icon: UserCog, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  ] : []

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  if (fetchError && users.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Manage platform users and permissions</p>
        </div>
        <ErrorState
          title="Failed to load users"
          message={fetchError}
          onRetry={() => { setLoading(true); fetchUsers() }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Users</h1>
          <p className="text-muted-foreground text-sm">Manage platform users and permissions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => { setLoading(true); fetchUsers() }}
        >
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map(s => (
            <Card key={s.title}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                    <s.icon className={`size-5 ${s.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{s.title}</p>
                    <p className="text-base font-semibold truncate">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={v => { setRoleFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="sales_rep">Sales Rep</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      {users.length === 0 ? (
        <EmptyState
          title="No users found"
          message={search || roleFilter !== 'all' ? 'No users match your search criteria.' : 'No users have been registered yet.'}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">Email</TableHead>
                  <TableHead className="text-xs">Role</TableHead>
                  <TableHead className="text-xs">Organizations</TableHead>
                  <TableHead className="text-xs">Joined</TableHead>
                  <TableHead className="text-xs w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                          {getInitials(u.name)}
                        </div>
                        <span className="font-medium text-sm truncate max-w-[160px]">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge className={roleBadge(u.role)} variant="outline">
                        {u.role === 'sales_rep' ? 'Sales Rep' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {u.organizations.length === 0 ? (
                          <span className="text-xs text-muted-foreground">None</span>
                        ) : (
                          u.organizations.slice(0, 2).map(org => (
                            <Badge key={org.id} variant="outline" className="text-[10px] py-0 truncate max-w-[100px]">
                              {org.name}
                            </Badge>
                          ))
                        )}
                        {u.organizations.length > 2 && (
                          <Badge variant="outline" className="text-[10px] py-0">
                            +{u.organizations.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => setSelectedUser(u)} title="View details">
                          <Eye className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(u)} title="Edit user">
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600" onClick={() => setDeleteUser(u)} title="Delete user">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto">
            {users.map(u => (
              <Card key={u.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                      {getInitials(u.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">{u.name}</h4>
                        <Badge className={roleBadge(u.role)} variant="outline">
                          {u.role === 'sales_rep' ? 'Rep' : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <div className="flex items-center gap-1">
                      {u.organizations.slice(0, 1).map(org => (
                        <Badge key={org.id} variant="outline" className="text-[10px] py-0">
                          {org.name}
                        </Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground">{formatDate(u.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => setSelectedUser(u)}>
                        <Eye className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-primary" onClick={() => openEdit(u)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600" onClick={() => setDeleteUser(u)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={open => { if (!open) setSelectedUser(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>View detailed information about this user.</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
                  {getInitials(selectedUser.name)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge className={roleBadge(selectedUser.role)} variant="outline">
                    {selectedUser.role === 'sales_rep' ? 'Sales Rep' : selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium">{formatDate(selectedUser.createdAt)}</p>
                </div>
              </div>

              {/* Organization Memberships */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Building2 className="size-4 text-primary" />
                  Organizations ({selectedUser.organizations.length})
                </h4>
                {selectedUser.organizations.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No organization memberships</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedUser.organizations.map(org => (
                      <div key={org.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/20">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{org.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{org.businessType} business</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0 ml-2">
                          {org.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => { setSelectedUser(null); openEdit(selectedUser) }}>
                  <Pencil className="size-3.5" /> Edit User
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => { setSelectedUser(null); setDeleteUser(selectedUser) }}>
                  <Trash2 className="size-3.5" /> Delete User
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={open => { if (!open) setEditUser(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information and role.</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email</Label>
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{editUser.email}</span>
                </div>
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="edit-role" className="text-sm font-medium">Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger id="edit-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editRole === 'admin' && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" /> Admin users have full platform access
                  </p>
                )}
              </div>

              {/* Password Reset */}
              <div className="space-y-2">
                <Label htmlFor="edit-password" className="text-sm font-medium">Reset Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Leave empty to keep current password"
                />
                <p className="text-xs text-muted-foreground">Enter a new password only if you want to reset it</p>
              </div>

              {/* Organizations Summary */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Organizations ({editUser.organizations.length})</Label>
                {editUser.organizations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No organizations</p>
                ) : (
                  <div className="space-y-1">
                    {editUser.organizations.map(org => (
                      <div key={org.id} className="flex items-center gap-2 text-xs">
                        <Store className="size-3 text-muted-foreground" />
                        <span className="truncate">{org.name}</span>
                        <Badge variant="outline" className="text-[10px] py-0 capitalize ml-auto shrink-0">{org.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={editLoading}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={editLoading}>
              {editLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={open => { if (!open) setDeleteUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-500" />
              Delete User
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
                  This action cannot be undone.
                </p>
                {deleteUser?.organizations.some(org => org.role === 'owner') && (
                  <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    <strong>Warning:</strong> This user is an owner of one or more organizations.
                    Organizations with no remaining owner will also be deleted along with all their data.
                  </div>
                )}
                <p className="text-muted-foreground text-xs">
                  All user data including memberships, sessions, and shop assignments will be permanently removed.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleteLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
