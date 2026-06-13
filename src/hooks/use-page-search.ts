'use client'
import { useState, useCallback, useEffect, useRef } from 'react'

export function usePageSearch(initialValue = '', debounceMs = 300) {
  const [search, setSearch] = useState(initialValue)
  const [debouncedSearch, setDebouncedSearch] = useState(initialValue)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search, debounceMs])

  const clearSearch = useCallback(() => {
    setSearch('')
  }, [])

  return { search, setSearch, debouncedSearch, clearSearch }
}
