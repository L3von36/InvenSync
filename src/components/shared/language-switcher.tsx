'use client'

import { Globe2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLanguageStore } from '@/lib/stores/language-store'
import type { Language } from '@/lib/i18n'

const LANGUAGES: Array<{ code: Language; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'am', label: 'አማርኛ', flag: '🇪🇹' },
]

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguageStore()

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          aria-label="Switch language"
        >
          <Globe2 className="size-4" />
          <span className="flex-1 text-left truncate">
            {currentLang.flag} {currentLang.label}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-44">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={language === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            <span>{lang.label}</span>
            {language === lang.code && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
