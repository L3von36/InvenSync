'use client'

import { PageHeader } from '@/components/shared/design-system'

import { useState, useEffect, useCallback } from 'react'
import {
  Megaphone, Search, Send, Eye, Clock, Info, AlertTriangle,
  Bell, Loader2, Building2, Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { getNetworkErrorMessage } from '@/lib/validation'
import { notificationTypeBadge, formatDateWithTime } from '@/lib/admin-utils'
import { ErrorState, EmptyState } from '@/components/shared/error-states'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// ============================================
// Types
// ============================================
interface Announcement {
  id: string
  title: string
  message: string
  type: string
  targetOrgId: string | null
  targetOrgName: string | null
  recipientCount: number
  createdAt: string
}

interface OrgOption {
  id: string
  name: string
  businessType: string
}

// ============================================
// Helpers
// ============================================
function typeIcon(type: string) {
  switch (type) {
    case 'info': return <Info className="size-4 text-sky-600 dark:text-sky-400" />
    case 'warning': return <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
    case 'announcement': return <Megaphone className="size-4 text-primary" />
    default: return <Bell className="size-4 text-muted-foreground" />
  }
}

// ============================================
// Tab 1: Send Announcement
// ============================================
function SendAnnouncementTab() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState('all')
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [type, setType] = useState('info')
  const [sending, setSending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Orgs list for dropdown
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [orgSearch, setOrgSearch] = useState('')

  useEffect(() => {
    setOrgsLoading(true)
    api.getAdminOrganizations({ limit: 100 })
      .then(data => setOrgs((data.organizations || []).map(o => ({ id: o.id, name: o.name, businessType: o.businessType }))))
      .catch(() => {})
      .finally(() => setOrgsLoading(false))
  }, [])

  const filteredOrgs = orgs.filter(o =>
    !orgSearch || o.name.toLowerCase().includes(orgSearch.toLowerCase())
  )

  const canSend = title.trim() && message.trim() && (target === 'all' || selectedOrgId)

  const handleSend = async () => {
    setSending(true)
    try {
      await api.sendAdminAnnouncement({
        title: title.trim(),
        message: message.trim(),
        targetOrgId: target === 'specific' ? selectedOrgId : undefined,
        type,
      })
      toast.success('Announcement sent successfully')
      setTitle('')
      setMessage('')
      setTarget('all')
      setSelectedOrgId('')
      setType('info')
      setConfirmOpen(false)
    } catch (err) {
      toast.error(getNetworkErrorMessage(err))
      setConfirmOpen(false)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="size-5 text-primary" />
                Compose Announcement
              </CardTitle>
              <CardDescription>Send a notification to organizations on the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  placeholder="e.g. System Maintenance Notice"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="ann-message">Message</Label>
                <Textarea
                  id="ann-message"
                  placeholder="Write your announcement message here..."
                  rows={5}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="announcement">Announcement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target */}
              <div className="space-y-2">
                <Label>Target</Label>
                <Select value={target} onValueChange={setTarget}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    <SelectItem value="specific">Specific Organization</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Specific Org Selector */}
              {target === 'specific' && (
                <div className="space-y-2">
                  <Label>Select Organization</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder="Search organizations..."
                      value={orgSearch}
                      onChange={e => setOrgSearch(e.target.value)}
                      className="pl-9 mb-2"
                    />
                  </div>
                  {orgsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an organization..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredOrgs.length === 0 ? (
                          <SelectItem value="_none" disabled>No organizations found</SelectItem>
                        ) : (
                          filteredOrgs.map(org => (
                            <SelectItem key={org.id} value={org.id}>
                              {org.name} ({org.businessType})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Send Button */}
              <Button
                className="w-full gap-1.5"
                onClick={() => setConfirmOpen(true)}
                disabled={!canSend}
              >
                <Send className="size-4" />
                Send Announcement
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="size-5 text-primary" />
                Preview
              </CardTitle>
              <CardDescription>How the notification will appear to recipients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                {/* Notification Preview */}
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-muted">
                    {typeIcon(type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">
                        {title || 'Announcement Title'}
                      </h4>
                      <Badge className={notificationTypeBadge(type)} variant="outline">
                        {type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                      {message || 'Your announcement message will appear here...'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        Just now
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {target === 'all' ? 'All Organizations' : (orgs.find(o => o.id === selectedOrgId)?.name || 'Specific Org')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <div className="p-3 rounded-lg border bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground">Recipients</p>
                  <p className="text-sm font-semibold">
                    {target === 'all' ? `${orgs.length} orgs` : '1 org'}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30 text-center">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm font-semibold capitalize">{type}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Send</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this announcement to{' '}
              <strong>{target === 'all' ? 'all organizations' : (orgs.find(o => o.id === selectedOrgId)?.name || 'the selected organization')}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{message}</p>
            <div className="flex items-center gap-2 pt-1">
              <Badge className={notificationTypeBadge(type)} variant="outline">{type}</Badge>
              <span className="text-xs text-muted-foreground">
                → {target === 'all' ? 'All Organizations' : orgs.find(o => o.id === selectedOrgId)?.name}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending && <Loader2 className="size-4 animate-spin" />}
              <Send className="size-4" />
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// Tab 2: Sent History
// ============================================
function SentHistoryTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchAnnouncements = useCallback(async () => {
    setFetchError(null)
    try {
      const data = await api.getAdminAnnouncements({
        type: typeFilter !== 'all' ? typeFilter : undefined,
        page,
        limit: 10,
      })
      setAnnouncements(data.announcements || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (err) {
      const msg = getNetworkErrorMessage(err)
      setFetchError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, page])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    )
  }

  if (fetchError && announcements.length === 0) {
    return (
      <ErrorState
        title="Failed to load announcements"
        message={fetchError}
        onRetry={() => { setLoading(true); fetchAnnouncements() }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="announcement">Announcement</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{announcements.length} announcement(s)</span>
      </div>

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <EmptyState
          title="No announcements sent"
          message="No announcements have been sent yet. Use the Send tab to compose one."
          icon={<Megaphone className="size-7 text-muted-foreground" />}
        />
      ) : (
        <div className="space-y-3 max-h-[60vh] md:max-h-[calc(100vh-340px)] overflow-y-auto">
          {announcements.map(ann => (
            <Card key={ann.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="size-10 sm:size-9 rounded-lg flex items-center justify-center shrink-0 bg-muted">
                    {typeIcon(ann.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm truncate">{ann.title}</h4>
                      <Badge className={notificationTypeBadge(ann.type)} variant="outline">
                        {ann.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ann.message}</p>
                    <div className="flex items-center gap-3 sm:gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1 min-h-[2.154rem]">
                        <Building2 className="size-3" />
                        {ann.targetOrgName || 'All Organizations'}
                      </span>
                      <span className="flex items-center gap-1 min-h-[2.154rem]">
                        <Users className="size-3" />
                        {ann.recipientCount} recipient{ann.recipientCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1 min-h-[2.154rem]">
                        <Clock className="size-3" />
                        {formatDateWithTime(ann.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
    </div>
  )
}

// ============================================
// Main Page Component
// ============================================
export function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState('send')

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={<Megaphone />}
        title="Notifications & Announcements"
        subtitle="Send platform-wide or targeted announcements"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="send" className="gap-1.5 text-xs sm:text-sm">
            <Send className="size-4" />
            <span className="hidden sm:inline">Send Announcement</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs sm:text-sm">
            <Clock className="size-4" />
            <span className="hidden sm:inline">Sent History</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <SendAnnouncementTab />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <SentHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
