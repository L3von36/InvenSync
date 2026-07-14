'use client'

import { useEffect, useRef } from 'react'
import type { ShopData } from '@/lib/api-client'
import { formatETB } from '@/lib/format'

// ============================================
// Lazy-loaded Map Component (YouTube Pattern)
// ============================================
// This component is dynamically imported to reduce initial bundle size.
// YouTube does the same with its player components — only loads when needed.

export function ShopsMapComponent({ shops }: { shops: ShopData[] }) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Inject leaflet CSS if not already loaded
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/css/leaflet.min.css'
      link.setAttribute('data-leaflet-css', 'true')
      document.head.appendChild(link)
    }

    import('leaflet').then((L) => {
      if (mapInstanceRef.current) return

      const map = L.map(mapContainerRef.current!).setView([9.0222, 38.7469], 6)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      // Create colored markers by business type
      const createIcon = (color: string) => L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -16],
      })

      const colorMap: Record<string, string> = {
        retail: '#ea580c',
        service: '#3b82f6',
        mixed: '#f59e0b',
      }

      shops.forEach(shop => {
        if (shop.latitude && shop.longitude) {
          const color = colorMap[shop.businessType] || '#6b7280'
          const marker = L.marker([shop.latitude, shop.longitude], { icon: createIcon(color) }).addTo(map)
          marker.bindPopup(`
            <div style="min-width:180px">
              <strong style="font-size:14px">${shop.name}</strong><br/>
              <span style="font-size:12px;color:#666">${shop.businessType || 'Retail'} · ${shop.city || 'N/A'}</span><br/>
              <span style="font-size:12px">Revenue: <strong>${formatETB(shop.totalRevenue, { decimals: 0 })}</strong></span><br/>
              <span style="font-size:12px">Shops: ${shop.shopCount || 0} · Members: ${shop.memberCount}</span>
            </div>
          `)
        }
      })

      mapInstanceRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
    })

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
      }
    }
  }, [shops])

  return (
    <div>
      <div ref={mapContainerRef} className="h-[23.077rem] md:h-[34.615rem] w-full rounded-lg border overflow-hidden z-0" />
      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { type: 'retail', label: 'Retail', color: 'bg-brand-500' },
          { type: 'service', label: 'Service', color: 'bg-blue-500' },
          { type: 'mixed', label: 'Mixed', color: 'bg-amber-500' },
        ].map(item => (
          <div key={item.type} className="flex items-center gap-1.5 text-xs">
            <div className={`size-3 rounded-full ${item.color}`} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
