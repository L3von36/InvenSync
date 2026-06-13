'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface LocationPickerProps {
  latitude: number | null
  longitude: number | null
  onChange: (lat: number, lng: number) => void
}

export function LocationPicker({ latitude, longitude, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<unknown>(null)
  const markerRef = useRef<unknown>(null)
  const [mounted, setMounted] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [detectError, setDetectError] = useState<string | null>(null)

  // Reverse geocode coordinates to get a place name
  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data.display_name) {
        // Shorten to just the relevant part
        const parts = data.display_name.split(',').slice(0, 3).join(',').trim()
        setLocationName(parts)
      }
    } catch {
      setLocationName(null)
    }
  }

  // Detect user's current GPS location
  const detectLocation = () => {
    if (!navigator.geolocation) {
      setDetectError('Geolocation is not supported by your browser')
      return
    }

    setDetecting(true)
    setDetectError(null)

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude: lat, longitude: lng } = position.coords
          onChange(lat, lng)
          reverseGeocode(lat, lng)
          setDetecting(false)
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setDetectError('Location permission denied. Please enable it in your browser settings.')
              break
            case error.POSITION_UNAVAILABLE:
              setDetectError('Location information is unavailable.')
              break
            case error.TIMEOUT:
              setDetectError('Location request timed out. Please try again.')
              break
            default:
              setDetectError('An unknown error occurred.')
          }
          setDetecting(false)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    } catch {
      setDetectError('Geolocation is not available in this environment.')
      setDetecting(false)
    }
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !mapRef.current || mapInstanceRef.current) return

    // Inject leaflet CSS if not already loaded
    if (!document.querySelector('link[data-leaflet-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/css/leaflet.min.css'
      link.setAttribute('data-leaflet-css', 'true')
      document.head.appendChild(link)
    }

    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      // Fix for default marker icon in leaflet + webpack/next
      const defaultIcon = L.icon({
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })
      L.Marker.prototype.options.icon = defaultIcon

      const center: [number, number] = latitude && longitude
        ? [latitude, longitude]
        : [9.0222, 38.7469] // Addis Ababa

      const map = L.map(mapRef.current).setView(center, 13)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map)

      // Add marker if coordinates exist
      if (latitude && longitude) {
        const marker = L.marker([latitude, longitude]).addTo(map)
        markerRef.current = marker
        reverseGeocode(latitude, longitude)
      }

      // Click to place marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng
        if (markerRef.current) {
          (markerRef.current as { setLatLng: (latlng: [number, number]) => void }).setLatLng([lat, lng])
        } else {
          const marker = L.marker([lat, lng]).addTo(map)
          markerRef.current = marker
        }
        onChange(lat, lng)
        reverseGeocode(lat, lng)
        setDetectError(null)
      })

      mapInstanceRef.current = map

      // Invalidate size after mount (fixes rendering issues)
      setTimeout(() => {
        map.invalidateSize()
      }, 100)
    })

    return () => {
      if (mapInstanceRef.current) {
        (mapInstanceRef.current as { remove: () => void }).remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
  }, [mounted])

  // Update marker position when coordinates change externally
  useEffect(() => {
    if (!mapInstanceRef.current || !latitude || !longitude) return
    const L = (window as unknown as { L?: { marker: (latlng: [number, number]) => { addTo: (map: unknown) => unknown } } }).L
    if (markerRef.current) {
      (markerRef.current as { setLatLng: (latlng: [number, number]) => void }).setLatLng([latitude, longitude])
    } else if (L) {
      markerRef.current = L.marker([latitude, longitude]).addTo(mapInstanceRef.current)
    }
    (mapInstanceRef.current as { setView: (center: [number, number], zoom: number) => void }).setView([latitude, longitude], 16)
  }, [latitude, longitude])

  if (!mounted) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-48 rounded-md" />
        <Skeleton className="h-[200px] md:h-[300px] w-full rounded-lg" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Detect Location Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={detectLocation}
        disabled={detecting}
        className="gap-2"
      >
        {detecting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Navigation className="size-4" />
        )}
        {detecting ? 'Detecting...' : 'Detect My Location'}
      </Button>

      {/* Map */}
      <div
        ref={mapRef}
        className="h-[200px] md:h-[300px] w-full rounded-lg border overflow-hidden z-0"
      />

      {/* Location Info */}
      {detectError && (
        <p className="text-xs text-destructive">{detectError}</p>
      )}
      {latitude && longitude ? (
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-primary mt-0.5 shrink-0" />
          <div>
            {locationName && (
              <p className="text-xs font-medium text-foreground">{locationName}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {latitude.toFixed(6)}, {longitude.toFixed(6)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          Click the map or tap &quot;Detect My Location&quot; to pin your exact business location
        </p>
      )}
    </div>
  )
}
