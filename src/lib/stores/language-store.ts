'use client'

import { create } from 'zustand'
import type { Language } from '@/lib/i18n'

const STORAGE_KEY = 'invensync-language'

interface LanguageState {
  language: Language
  setLanguage: (language: Language) => void
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: (() => {
    if (typeof window === 'undefined') return 'en'
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null
    return saved === 'am' || saved === 'en' ? saved : 'en'
  })(),

  setLanguage: (language: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, language)
    }
    set({ language })
  },
}))
