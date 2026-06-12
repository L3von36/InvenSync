'use client'

import { Lock, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useAppStore } from '@/lib/stores/app-store'

interface ModuleGuardProps {
  moduleKey: string // e.g. 'inventory', 'sales', 'debts', 'ai-assistant'
  children: React.ReactNode
  /** Module display name for the locked message */
  moduleName?: string
}

export function ModuleGuard({ moduleKey, children, moduleName }: ModuleGuardProps) {
  const { activeModules, currentOrg } = useAuthStore()
  const { setPage } = useAppStore()
  
  // If modules haven't been loaded yet (empty array = graceful degradation), show content
  // This matches the sidebar behavior where items are shown when modules aren't loaded
  if (activeModules.length === 0) {
    return <>{children}</>
  }
  
  // If the module is active, show the content
  if (activeModules.includes(moduleKey)) {
    return <>{children}</>
  }
  
  // Module is not active - show locked screen
  const displayName = moduleName || moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1).replace(/-/g, ' ')
  
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="pb-3">
          <div className="mx-auto flex items-center justify-center size-14 rounded-full bg-muted mb-3">
            <Lock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle className="text-base">{displayName} Not Available</CardTitle>
          <CardDescription className="text-sm">
            This feature requires the <span className="font-medium">{displayName}</span> module, which is not currently active for your organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {currentOrg?.name ? `${currentOrg.name} doesn't have access to this module. Contact your organization owner or visit My Modules to subscribe.` : 'Visit My Modules to subscribe to this feature.'}
          </p>
          <Button
            variant="outline"
            onClick={() => setPage('modules')}
            className="w-full gap-2"
          >
            <Package className="size-4" />
            View My Modules
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
